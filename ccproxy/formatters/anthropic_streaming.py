"""Anthropic-format streaming utilities.

This module handles streaming responses in Anthropic's native SSE (Server-Sent Events) format.
It is used for converting Claude SDK responses to Anthropic API format for the /v1/messages endpoint.

For OpenAI-format streaming, see:
- openai_streaming_formatter.py: OpenAI SSE formatting utilities
- stream_transformer.py: Unified stream transformation framework
"""

import asyncio
import json
from collections.abc import AsyncGenerator, AsyncIterable
from typing import Any

from ccproxy.models.errors import ErrorDetail, StreamingError
from ccproxy.utils.logging import get_logger


logger = get_logger(__name__)


class StreamingFormatter:
    """Formats streaming responses to match Anthropic's SSE format."""

    @staticmethod
    def format_event(event_type: str, data: dict[str, Any]) -> str:
        """
        Format an event for Server-Sent Events.

        Args:
            event_type: Type of the event
            data: Event data dictionary

        Returns:
            Formatted SSE string
        """
        json_data = json.dumps(data, separators=(",", ":"))
        return f"event: {event_type}\ndata: {json_data}\n\n"

    @staticmethod
    def format_data_only(data: dict[str, Any]) -> str:
        """
        Format SSE event with explicit event type.

        Args:
            data: Event data dictionary

        Returns:
            Formatted SSE string with event type
        """
        json_data = json.dumps(data, separators=(",", ":"))
        event_type = data.get("type", "unknown")
        return f"event: {event_type}\ndata: {json_data}\n\n"

    @staticmethod
    def format_message_start(
        message_id: str, model: str, role: str = "assistant"
    ) -> str:
        """Format message start event."""
        data = {
            "type": "message_start",
            "message": {
                "id": message_id,
                "type": "message",
                "role": role,
                "content": [],
                "model": model,
                "stop_reason": None,
                "stop_sequence": None,
                "usage": {"input_tokens": 0, "output_tokens": 0},
            },
        }
        return StreamingFormatter.format_data_only(data)

    @staticmethod
    def format_content_block_start(index: int = 0) -> str:
        """Format content block start event."""
        data = {
            "type": "content_block_start",
            "index": index,
            "content_block": {"type": "text", "text": ""},
        }
        return StreamingFormatter.format_data_only(data)

    @staticmethod
    def format_content_block_delta(text: str, index: int = 0) -> str:
        """Format content block delta event."""
        data = {
            "type": "content_block_delta",
            "index": index,
            "delta": {"type": "text_delta", "text": text},
        }
        return StreamingFormatter.format_data_only(data)

    @staticmethod
    def format_content_block_stop(index: int = 0) -> str:
        """Format content block stop event."""
        data = {"type": "content_block_stop", "index": index}
        return StreamingFormatter.format_data_only(data)

    @staticmethod
    def format_message_delta(
        stop_reason: str = "end_turn", stop_sequence: str | None = None
    ) -> str:
        """Format message delta event."""
        data = {
            "type": "message_delta",
            "delta": {"stop_reason": stop_reason, "stop_sequence": stop_sequence},
            "usage": {"output_tokens": 0},
        }
        return StreamingFormatter.format_data_only(data)

    @staticmethod
    def format_message_stop() -> str:
        """Format message stop event."""
        data = {"type": "message_stop"}
        return StreamingFormatter.format_data_only(data)

    @staticmethod
    def format_error(error_type: str, message: str) -> str:
        """Format streaming error event."""
        error = StreamingError(error=ErrorDetail(type=error_type, message=message))
        return StreamingFormatter.format_data_only(error.model_dump())

    @staticmethod
    def format_done() -> str:
        """Format the final DONE event."""
        return "data: [DONE]\n\n"


async def stream_claude_response(
    claude_response_iterator: AsyncIterable[dict[str, Any]],
    message_id: str,
    model: str,
) -> AsyncGenerator[str, None]:
    """
    Convert Claude SDK response to Anthropic-compatible streaming format.

    Args:
        claude_response_iterator: Async iterator of Claude response chunks
        message_id: Unique message identifier
        model: Model name being used

    Yields:
        Formatted SSE strings

    Raises:
        TypeError: If claude_response_iterator is not an async iterable
    """
    formatter = StreamingFormatter()

    # Validate that we have an async iterable
    if not hasattr(claude_response_iterator, "__aiter__"):
        logger.error(f"Expected async iterable, got {type(claude_response_iterator)}")
        yield formatter.format_error(
            "internal_server_error", "Invalid response type from Claude client"
        )
        yield formatter.format_done()
        return

    try:
        # Send message start event
        yield formatter.format_message_start(message_id, model)

        # Send content block start
        yield formatter.format_content_block_start()

        # Process Claude response chunks
        has_content = False
        try:
            async for chunk in claude_response_iterator:
                # Process chunk if it's a dict
                if not isinstance(chunk, dict):
                    logger.warning(f"Expected dict chunk, got {type(chunk)}: {chunk}")  # type: ignore[unreachable]
                elif chunk.get("type") == "content_block_delta":
                    text = chunk.get("delta", {}).get("text", "")
                    if text:
                        has_content = True
                        yield formatter.format_content_block_delta(text)
                elif chunk.get("type") == "message_delta":
                    # Message is ending
                    yield formatter.format_content_block_stop()
                    stop_reason = chunk.get("delta", {}).get("stop_reason", "end_turn")
                    stop_sequence = chunk.get("delta", {}).get("stop_sequence")
                    yield formatter.format_message_delta(stop_reason, stop_sequence)
                    yield formatter.format_message_stop()
                    break

            # If we never got content, still need to close properly
            if not has_content:
                yield formatter.format_content_block_stop()
                yield formatter.format_message_delta()
                yield formatter.format_message_stop()

        except asyncio.CancelledError:
            # Handle stream cancellation gracefully
            logger.info("Claude response stream cancelled")
            if not has_content:
                yield formatter.format_content_block_stop()
            yield formatter.format_message_delta(stop_reason="cancelled")
            yield formatter.format_message_stop()
            raise
        except Exception as e:
            logger.error(f"Error processing Claude response chunks: {e}")
            # Close content block if it was started
            if not has_content:
                yield formatter.format_content_block_stop()
            yield formatter.format_message_delta(stop_reason="error")
            yield formatter.format_message_stop()
            raise

    except asyncio.CancelledError:
        # Handle outer cancellation
        logger.info("Streaming response cancelled")
        raise
    except Exception as e:
        logger.error(f"Error in streaming response: {e}")
        yield formatter.format_error("internal_server_error", str(e))

    finally:
        # Always send DONE at the end
        yield formatter.format_done()


async def stream_anthropic_message_response(
    claude_response_iterator: AsyncIterable[dict[str, Any]],
    message_id: str,
    model: str,
) -> AsyncGenerator[str, None]:
    """
    Convert Claude SDK response to Anthropic Messages API streaming format.

    This is essentially the same as stream_claude_response but maintains
    a separate function for clarity and potential future differences.

    Args:
        claude_response_iterator: Async iterator of Claude response chunks
        message_id: Unique message identifier
        model: Model name being used

    Yields:
        Formatted SSE strings for Anthropic Messages API

    Raises:
        TypeError: If claude_response_iterator is not an async iterable
    """
    # Use the same streaming logic as the chat completions endpoint
    async for chunk in stream_claude_response(
        claude_response_iterator, message_id, model
    ):
        yield chunk
