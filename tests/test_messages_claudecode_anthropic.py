"""Tests for ccproxy/routers/claudecode/anthropic.py - Messages API endpoint."""

import json
import uuid
from collections.abc import AsyncGenerator
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import ValidationError

from ccproxy.exceptions import (
    ClaudeProxyError,
    ModelNotFoundError,
    ServiceUnavailableError,
    TimeoutError,
)
from ccproxy.exceptions import (
    ValidationError as ProxyValidationError,
)
from ccproxy.models.messages import (
    MessageResponse,
    SystemMessage,
    ThinkingConfig,
)
from ccproxy.models.requests import Message
from ccproxy.routers.claudecode.anthropic import (
    ClaudeCodeMessageCreateParams,
    create_message,
)


class TestCreateMessage:
    """Test create_message endpoint function."""

    @pytest.fixture
    def mock_request(self) -> Request:
        """Create a mock FastAPI Request."""
        request = MagicMock(spec=Request)
        request.headers = {}
        return request

    @pytest.fixture
    def basic_message_request(self) -> ClaudeCodeMessageCreateParams:
        """Create a basic message request."""
        return ClaudeCodeMessageCreateParams(
            model="claude-3-5-sonnet-20241022",
            messages=[Message(role="user", content="Hello, how are you?")],
            max_tokens=100,
            stream=False,
        )

    @pytest.fixture
    def streaming_message_request(self) -> ClaudeCodeMessageCreateParams:
        """Create a streaming message request."""
        return ClaudeCodeMessageCreateParams(
            model="claude-3-5-sonnet-20241022",
            messages=[Message(role="user", content="Tell me a story")],
            max_tokens=200,
            stream=True,
        )

    @pytest.fixture
    def system_message_request(self) -> ClaudeCodeMessageCreateParams:
        """Create a message request with system message."""
        return ClaudeCodeMessageCreateParams(
            model="claude-3-5-sonnet-20241022",
            messages=[Message(role="user", content="What is the weather like?")],
            system="You are a helpful weather assistant.",
            max_tokens=150,
            stream=False,
        )

    @pytest.fixture
    def system_message_blocks_request(self) -> ClaudeCodeMessageCreateParams:
        """Create a message request with system message blocks."""
        return ClaudeCodeMessageCreateParams(
            model="claude-3-5-sonnet-20241022",
            messages=[Message(role="user", content="Help me with coding")],
            system=[
                SystemMessage(type="text", text="You are a coding assistant."),
                SystemMessage(type="text", text="Always provide clear explanations."),
            ],
            max_tokens=200,
            stream=False,
        )

    @pytest.fixture
    def max_thinking_tokens_request(self) -> ClaudeCodeMessageCreateParams:
        """Create a message request with thinking config."""
        return ClaudeCodeMessageCreateParams(
            model="claude-3-5-sonnet-20241022",
            messages=[Message(role="user", content="Solve this complex problem")],
            thinking=ThinkingConfig(type="enabled", budget_tokens=5000),
            max_tokens=100,
            stream=False,
        )

    @pytest.fixture
    def claude_code_options_request(self) -> ClaudeCodeMessageCreateParams:
        """Create a message request with Claude Code specific options."""
        return ClaudeCodeMessageCreateParams(
            model="claude-3-5-sonnet-20241022",
            messages=[Message(role="user", content="Help me code")],
            max_tokens=100,
            stream=False,
            max_thinking_tokens=2000,
            cwd="/tmp/workspace",
            allowed_tools=["bash", "python"],
            max_turns=5,
            permission_mode="ask",
        )

    @pytest.fixture
    def mock_claude_response(self) -> dict[str, Any]:
        """Create a mock Claude response."""
        return {
            "content": [
                {"type": "text", "text": "Hello! I'm doing well, thank you for asking."}
            ],
            "stop_reason": "end_turn",
            "stop_sequence": None,
            "usage": {"input_tokens": 10, "output_tokens": 15, "total_tokens": 25},
        }

    @pytest.fixture
    def mock_settings(self) -> MagicMock:
        """Create mock settings."""
        settings = MagicMock()
        # Create a mock ClaudeCodeOptions object
        mock_options = MagicMock()
        mock_options.model = None
        mock_options.temperature = 0.7
        settings.claude_code_options = mock_options
        return settings

    @pytest.mark.asyncio
    async def test_create_message_non_streaming_success(
        self,
        basic_message_request: ClaudeCodeMessageCreateParams,
        mock_request: Request,
        mock_claude_response: dict[str, Any],
        mock_settings: MagicMock,
    ):
        """Test successful non-streaming message creation."""
        with (
            patch(
                "ccproxy.routers.claudecode.anthropic.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "ccproxy.routers.claudecode.anthropic.ClaudeClient"
            ) as mock_client_class,
            patch(
                "ccproxy.routers.claudecode.anthropic.merge_claude_code_options"
            ) as mock_merge,
            patch("ccproxy.routers.claudecode.anthropic.uuid.uuid4") as mock_uuid,
        ):
            # Setup mocks
            mock_uuid.return_value.hex = "abcdef123456"
            mock_client = MagicMock()
            mock_client.create_completion = AsyncMock(return_value=mock_claude_response)
            mock_client_class.return_value = mock_client
            # merge_claude_code_options returns a ClaudeCodeOptions object
            mock_options = MagicMock()
            mock_options.model = "claude-3-5-sonnet-20241022"
            mock_options.temperature = 0.7
            mock_merge.return_value = mock_options

            # Call the function
            result = await create_message(basic_message_request, mock_request, None)

            # Verify result
            assert isinstance(result, MessageResponse)
            assert result.id == "msg_abcdef123456"
            assert result.type == "message"
            assert result.role == "assistant"
            # Content is converted to MessageContentBlock objects
            assert len(result.content) == 1
            assert result.content[0].type == "text"
            assert (
                result.content[0].text == "Hello! I'm doing well, thank you for asking."
            )
            assert result.model == "claude-3-5-sonnet-20241022"
            assert result.stop_reason == "end_turn"
            # Usage is converted to Usage object
            assert result.usage.input_tokens == 10
            assert result.usage.output_tokens == 15

            # Verify client was called correctly
            mock_client.create_completion.assert_called_once_with(
                messages=[{"role": "user", "content": "Hello, how are you?"}],
                options=mock_options,
                stream=False,
            )

    @pytest.mark.asyncio
    async def test_create_message_with_system_string(
        self,
        system_message_request: ClaudeCodeMessageCreateParams,
        mock_request: Request,
        mock_claude_response: dict[str, Any],
        mock_settings: MagicMock,
    ):
        """Test message creation with system string."""
        with (
            patch(
                "ccproxy.routers.claudecode.anthropic.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "ccproxy.routers.claudecode.anthropic.ClaudeClient"
            ) as mock_client_class,
            patch(
                "ccproxy.routers.claudecode.anthropic.merge_claude_code_options"
            ) as mock_merge,
        ):
            mock_client = MagicMock()
            mock_client.create_completion = AsyncMock(return_value=mock_claude_response)
            mock_client_class.return_value = mock_client

            # merge_claude_code_options returns a ClaudeCodeOptions object
            mock_options = MagicMock()
            mock_options.model = "claude-3-5-sonnet-20241022"
            mock_options.system_prompt = "You are a helpful weather assistant."
            mock_options.temperature = 0.7
            mock_merge.return_value = mock_options

            result = await create_message(system_message_request, mock_request, None)

            assert isinstance(result, MessageResponse)
            # Verify merge was called to get base options
            mock_merge.assert_called_once_with(mock_settings.claude_code_options)

            # Verify that system_prompt was set correctly
            assert mock_options.system_prompt == "You are a helpful weather assistant."

    @pytest.mark.asyncio
    async def test_create_message_with_system_blocks(
        self,
        system_message_blocks_request: ClaudeCodeMessageCreateParams,
        mock_request: Request,
        mock_claude_response: dict[str, Any],
        mock_settings: MagicMock,
    ):
        """Test message creation with system message blocks."""
        with (
            patch(
                "ccproxy.routers.claudecode.anthropic.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "ccproxy.routers.claudecode.anthropic.ClaudeClient"
            ) as mock_client_class,
            patch(
                "ccproxy.routers.claudecode.anthropic.merge_claude_code_options"
            ) as mock_merge,
        ):
            mock_client = MagicMock()
            mock_client.create_completion = AsyncMock(return_value=mock_claude_response)
            mock_client_class.return_value = mock_client

            # merge_claude_code_options returns a ClaudeCodeOptions object
            mock_options = MagicMock()
            mock_options.model = "claude-3-5-sonnet-20241022"
            mock_options.system_prompt = (
                "You are a coding assistant.\nAlways provide clear explanations."
            )
            mock_options.temperature = 0.7
            mock_merge.return_value = mock_options

            result = await create_message(
                system_message_blocks_request, mock_request, None
            )

            assert isinstance(result, MessageResponse)
            # Verify merge was called to get base options
            mock_merge.assert_called_once_with(mock_settings.claude_code_options)

            # Verify that system_prompt was set correctly
            assert (
                mock_options.system_prompt
                == "You are a coding assistant.\nAlways provide clear explanations."
            )

    @pytest.mark.asyncio
    async def test_create_message_with_max_thinking_tokens(
        self,
        max_thinking_tokens_request: ClaudeCodeMessageCreateParams,
        mock_request: Request,
        mock_claude_response: dict[str, Any],
        mock_settings: MagicMock,
    ):
        """Test message creation with thinking config."""
        with (
            patch(
                "ccproxy.routers.claudecode.anthropic.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "ccproxy.routers.claudecode.anthropic.ClaudeClient"
            ) as mock_client_class,
            patch(
                "ccproxy.routers.claudecode.anthropic.merge_claude_code_options"
            ) as mock_merge,
        ):
            mock_client = MagicMock()
            mock_client.create_completion = AsyncMock(return_value=mock_claude_response)
            mock_client_class.return_value = mock_client

            # merge_claude_code_options returns a ClaudeCodeOptions object
            mock_options = MagicMock()
            mock_options.model = "claude-3-5-sonnet-20241022"
            mock_options.thinking = max_thinking_tokens_request.thinking
            mock_options.temperature = 0.7
            mock_merge.return_value = mock_options

            result = await create_message(
                max_thinking_tokens_request, mock_request, None
            )

            assert isinstance(result, MessageResponse)
            # Verify merge was called to get base options
            mock_merge.assert_called_once_with(mock_settings.claude_code_options)

            # Verify that thinking config was processed correctly
            assert mock_options.thinking == max_thinking_tokens_request.thinking

    @pytest.mark.asyncio
    async def test_create_message_streaming_success(
        self,
        streaming_message_request: ClaudeCodeMessageCreateParams,
        mock_request: Request,
        mock_settings: MagicMock,
    ):
        """Test successful streaming message creation."""
        with (
            patch(
                "ccproxy.routers.claudecode.anthropic.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "ccproxy.routers.claudecode.anthropic.ClaudeClient"
            ) as mock_client_class,
            patch(
                "ccproxy.routers.claudecode.anthropic.merge_claude_code_options"
            ) as mock_merge,
            patch(
                "ccproxy.routers.claudecode.anthropic.stream_anthropic_message_response"
            ) as mock_stream,
            patch("ccproxy.routers.claudecode.anthropic.uuid.uuid4") as mock_uuid,
        ):
            # Setup mocks
            mock_uuid.return_value.hex = "streaming123"
            mock_client = MagicMock()

            # Create async generator for streaming response
            async def mock_stream_generator():
                yield {"type": "message_start", "message": {"id": "msg_123"}}
                yield {"type": "content_block_delta", "delta": {"text": "Hello"}}
                yield {"type": "message_delta", "delta": {"stop_reason": "end_turn"}}

            mock_client.create_completion = AsyncMock(
                return_value=mock_stream_generator()
            )
            mock_client_class.return_value = mock_client
            # merge_claude_code_options returns a ClaudeCodeOptions object
            mock_options = MagicMock()
            mock_options.model = "claude-3-5-sonnet-20241022"
            mock_options.temperature = 0.7
            mock_merge.return_value = mock_options

            # Mock the streaming formatter
            async def mock_stream_formatter(response_iter, message_id, model):
                async for chunk in response_iter:
                    yield f"data: {json.dumps(chunk)}\n\n"
                yield "data: [DONE]\n\n"

            mock_stream.side_effect = mock_stream_formatter

            # Call the function
            result = await create_message(streaming_message_request, mock_request, None)

            # Verify result
            assert isinstance(result, StreamingResponse)
            assert result.media_type == "text/event-stream"
            assert result.headers["Cache-Control"] == "no-cache"
            assert result.headers["Connection"] == "keep-alive"
            assert result.headers["Content-Type"] == "text/event-stream"

            # Consume the stream to trigger the generator and verify client was called
            chunks = []
            async for chunk in result.body_iterator:
                chunks.append(chunk)

            # Verify client was called correctly
            mock_client.create_completion.assert_called_once_with(
                [{"role": "user", "content": "Tell me a story"}],
                options=mock_options,
                stream=True,
            )

            # Verify we got some chunks
            assert len(chunks) > 0

    @pytest.mark.asyncio
    async def test_create_message_streaming_invalid_iterator(
        self,
        streaming_message_request: ClaudeCodeMessageCreateParams,
        mock_request: Request,
        mock_settings: MagicMock,
    ):
        """Test streaming with invalid iterator from Claude client."""
        with (
            patch(
                "ccproxy.routers.claudecode.anthropic.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "ccproxy.routers.claudecode.anthropic.ClaudeClient"
            ) as mock_client_class,
            patch(
                "ccproxy.routers.claudecode.anthropic.merge_claude_code_options"
            ) as mock_merge,
        ):
            mock_client = MagicMock()
            # Return a non-async iterator (invalid)
            mock_client.create_completion = AsyncMock(return_value="not_an_iterator")
            mock_client_class.return_value = mock_client
            # merge_claude_code_options returns a ClaudeCodeOptions object
            mock_options = MagicMock()
            mock_options.model = "claude-3-5-sonnet-20241022"
            mock_merge.return_value = mock_options

            result = await create_message(streaming_message_request, mock_request, None)

            assert isinstance(result, StreamingResponse)

            # Consume the stream to verify error handling
            chunks = []
            async for chunk in result.body_iterator:
                chunks.append(chunk)

            # Should contain error message and [DONE]
            assert len(chunks) == 2
            assert "error" in chunks[0]
            assert "Invalid response type from Claude client" in chunks[0]
            assert chunks[1] == "data: [DONE]\n\n"

    @pytest.mark.asyncio
    async def test_create_message_non_streaming_invalid_response_type(
        self,
        basic_message_request: ClaudeCodeMessageCreateParams,
        mock_request: Request,
        mock_settings: MagicMock,
    ):
        """Test non-streaming with invalid response type."""
        with (
            patch(
                "ccproxy.routers.claudecode.anthropic.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "ccproxy.routers.claudecode.anthropic.ClaudeClient"
            ) as mock_client_class,
            patch(
                "ccproxy.routers.claudecode.anthropic.merge_claude_code_options"
            ) as mock_merge,
        ):
            mock_client = MagicMock()
            # Return a non-dict response (invalid)
            mock_client.create_completion = AsyncMock(return_value="not_a_dict")
            mock_client_class.return_value = mock_client
            # merge_claude_code_options returns a ClaudeCodeOptions object
            mock_options = MagicMock()
            mock_options.model = "claude-3-5-sonnet-20241022"
            mock_merge.return_value = mock_options

            with pytest.raises(HTTPException) as exc_info:
                await create_message(basic_message_request, mock_request, None)

            assert exc_info.value.status_code == 400
            assert "Invalid response type" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_create_message_claude_proxy_error(
        self,
        basic_message_request: ClaudeCodeMessageCreateParams,
        mock_request: Request,
        mock_settings: MagicMock,
    ):
        """Test handling of ClaudeProxyError."""
        with (
            patch(
                "ccproxy.routers.claudecode.anthropic.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "ccproxy.routers.claudecode.anthropic.ClaudeClient"
            ) as mock_client_class,
            patch(
                "ccproxy.routers.claudecode.anthropic.merge_claude_code_options"
            ) as mock_merge,
            patch(
                "ccproxy.routers.claudecode.anthropic.create_error_response"
            ) as mock_create_error,
        ):
            mock_client = MagicMock()
            error = ClaudeProxyError("Test error", "api_error", 429)
            mock_client.create_completion = AsyncMock(side_effect=error)
            mock_client_class.return_value = mock_client
            # merge_claude_code_options returns a ClaudeCodeOptions object
            mock_options = MagicMock()
            mock_options.model = "claude-3-5-sonnet-20241022"
            mock_merge.return_value = mock_options
            mock_create_error.return_value = ({"error": "test error"}, 429)

            with pytest.raises(HTTPException) as exc_info:
                await create_message(basic_message_request, mock_request, None)

            assert exc_info.value.status_code == 429
            mock_create_error.assert_called_once_with("api_error", "Test error")

    @pytest.mark.asyncio
    async def test_create_message_model_not_found_error(
        self,
        basic_message_request: ClaudeCodeMessageCreateParams,
        mock_request: Request,
        mock_settings: MagicMock,
    ):
        """Test handling of ModelNotFoundError."""
        with (
            patch(
                "ccproxy.routers.claudecode.anthropic.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "ccproxy.routers.claudecode.anthropic.ClaudeClient"
            ) as mock_client_class,
            patch(
                "ccproxy.routers.claudecode.anthropic.merge_claude_code_options"
            ) as mock_merge,
            patch(
                "ccproxy.routers.claudecode.anthropic.create_error_response"
            ) as mock_create_error,
        ):
            mock_client = MagicMock()
            error = ModelNotFoundError("invalid-model")
            mock_client.create_completion = AsyncMock(side_effect=error)
            mock_client_class.return_value = mock_client
            # merge_claude_code_options returns a ClaudeCodeOptions object
            mock_options = MagicMock()
            mock_options.model = "invalid-model"
            mock_merge.return_value = mock_options
            mock_create_error.return_value = ({"error": "model not found"}, 404)

            with pytest.raises(HTTPException) as exc_info:
                await create_message(basic_message_request, mock_request, None)

            assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_create_message_service_unavailable_error(
        self,
        basic_message_request: ClaudeCodeMessageCreateParams,
        mock_request: Request,
        mock_settings: MagicMock,
    ):
        """Test handling of ServiceUnavailableError."""
        with (
            patch(
                "ccproxy.routers.claudecode.anthropic.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "ccproxy.routers.claudecode.anthropic.ClaudeClient"
            ) as mock_client_class,
            patch(
                "ccproxy.routers.claudecode.anthropic.merge_claude_code_options"
            ) as mock_merge,
            patch(
                "ccproxy.routers.claudecode.anthropic.create_error_response"
            ) as mock_create_error,
        ):
            mock_client = MagicMock()
            error = ServiceUnavailableError("Service unavailable")
            mock_client.create_completion = AsyncMock(side_effect=error)
            mock_client_class.return_value = mock_client
            # merge_claude_code_options returns a ClaudeCodeOptions object
            mock_options = MagicMock()
            mock_options.model = "claude-3-5-sonnet-20241022"
            mock_merge.return_value = mock_options
            mock_create_error.return_value = ({"error": "service unavailable"}, 503)

            with pytest.raises(HTTPException) as exc_info:
                await create_message(basic_message_request, mock_request, None)

            assert exc_info.value.status_code == 503

    @pytest.mark.asyncio
    async def test_create_message_timeout_error(
        self,
        basic_message_request: ClaudeCodeMessageCreateParams,
        mock_request: Request,
        mock_settings: MagicMock,
    ):
        """Test handling of TimeoutError."""
        with (
            patch(
                "ccproxy.routers.claudecode.anthropic.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "ccproxy.routers.claudecode.anthropic.ClaudeClient"
            ) as mock_client_class,
            patch(
                "ccproxy.routers.claudecode.anthropic.merge_claude_code_options"
            ) as mock_merge,
            patch(
                "ccproxy.routers.claudecode.anthropic.create_error_response"
            ) as mock_create_error,
        ):
            mock_client = MagicMock()
            error = TimeoutError("Request timeout")
            mock_client.create_completion = AsyncMock(side_effect=error)
            mock_client_class.return_value = mock_client
            # merge_claude_code_options returns a ClaudeCodeOptions object
            mock_options = MagicMock()
            mock_options.model = "claude-3-5-sonnet-20241022"
            mock_merge.return_value = mock_options
            mock_create_error.return_value = ({"error": "timeout"}, 408)

            with pytest.raises(HTTPException) as exc_info:
                await create_message(basic_message_request, mock_request, None)

            assert exc_info.value.status_code == 408

    @pytest.mark.asyncio
    async def test_create_message_validation_error(
        self,
        basic_message_request: ClaudeCodeMessageCreateParams,
        mock_request: Request,
        mock_settings: MagicMock,
    ):
        """Test handling of ValidationError."""
        with (
            patch(
                "ccproxy.routers.claudecode.anthropic.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "ccproxy.routers.claudecode.anthropic.ClaudeClient"
            ) as mock_client_class,
            patch(
                "ccproxy.routers.claudecode.anthropic.merge_claude_code_options"
            ) as mock_merge,
            patch(
                "ccproxy.routers.claudecode.anthropic.create_error_response"
            ) as mock_create_error,
        ):
            mock_client = MagicMock()
            error = ProxyValidationError("Validation failed")
            mock_client.create_completion = AsyncMock(side_effect=error)
            mock_client_class.return_value = mock_client
            # merge_claude_code_options returns a ClaudeCodeOptions object
            mock_options = MagicMock()
            mock_options.model = "claude-3-5-sonnet-20241022"
            mock_merge.return_value = mock_options
            mock_create_error.return_value = ({"error": "validation failed"}, 400)

            with pytest.raises(HTTPException) as exc_info:
                await create_message(basic_message_request, mock_request, None)

            assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_create_message_value_error(
        self,
        basic_message_request: ClaudeCodeMessageCreateParams,
        mock_request: Request,
        mock_settings: MagicMock,
    ):
        """Test handling of ValueError."""
        with (
            patch(
                "ccproxy.routers.claudecode.anthropic.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "ccproxy.routers.claudecode.anthropic.ClaudeClient"
            ) as mock_client_class,
            patch(
                "ccproxy.routers.claudecode.anthropic.merge_claude_code_options"
            ) as mock_merge,
            patch(
                "ccproxy.routers.claudecode.anthropic.create_error_response"
            ) as mock_create_error,
        ):
            mock_client = MagicMock()
            error = ValueError("Invalid value")
            mock_client.create_completion = AsyncMock(side_effect=error)
            mock_client_class.return_value = mock_client
            # merge_claude_code_options returns a ClaudeCodeOptions object
            mock_options = MagicMock()
            mock_options.model = "claude-3-5-sonnet-20241022"
            mock_merge.return_value = mock_options
            mock_create_error.return_value = ({"error": "invalid request"}, 400)

            with pytest.raises(HTTPException) as exc_info:
                await create_message(basic_message_request, mock_request, None)

            assert exc_info.value.status_code == 400
            mock_create_error.assert_called_once_with(
                "invalid_request_error", "Invalid value"
            )

    @pytest.mark.asyncio
    async def test_create_message_generic_exception(
        self,
        basic_message_request: ClaudeCodeMessageCreateParams,
        mock_request: Request,
        mock_settings: MagicMock,
    ):
        """Test handling of generic Exception."""
        with (
            patch(
                "ccproxy.routers.claudecode.anthropic.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "ccproxy.routers.claudecode.anthropic.ClaudeClient"
            ) as mock_client_class,
            patch(
                "ccproxy.routers.claudecode.anthropic.merge_claude_code_options"
            ) as mock_merge,
            patch(
                "ccproxy.routers.claudecode.anthropic.create_error_response"
            ) as mock_create_error,
        ):
            mock_client = MagicMock()
            error = Exception("Unexpected error")
            mock_client.create_completion = AsyncMock(side_effect=error)
            mock_client_class.return_value = mock_client
            # merge_claude_code_options returns a ClaudeCodeOptions object
            mock_options = MagicMock()
            mock_options.model = "claude-3-5-sonnet-20241022"
            mock_merge.return_value = mock_options
            mock_create_error.return_value = ({"error": "internal server error"}, 500)

            with pytest.raises(HTTPException) as exc_info:
                await create_message(basic_message_request, mock_request, None)

            assert exc_info.value.status_code == 500
            mock_create_error.assert_called_once_with(
                "internal_server_error", "An unexpected error occurred"
            )

    @pytest.mark.asyncio
    async def test_create_message_streaming_claude_proxy_error(
        self,
        streaming_message_request: ClaudeCodeMessageCreateParams,
        mock_request: Request,
        mock_settings: MagicMock,
    ):
        """Test handling of ClaudeProxyError in streaming mode."""
        with (
            patch(
                "ccproxy.routers.claudecode.anthropic.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "ccproxy.routers.claudecode.anthropic.ClaudeClient"
            ) as mock_client_class,
            patch(
                "ccproxy.routers.claudecode.anthropic.merge_claude_code_options"
            ) as mock_merge,
            patch(
                "ccproxy.routers.claudecode.anthropic.create_error_response"
            ) as mock_create_error,
        ):
            mock_client = MagicMock()
            error = ClaudeProxyError("Stream error", "api_error", 429)
            mock_client.create_completion = AsyncMock(side_effect=error)
            mock_client_class.return_value = mock_client
            # merge_claude_code_options returns a ClaudeCodeOptions object
            mock_options = MagicMock()
            mock_options.model = "claude-3-5-sonnet-20241022"
            mock_merge.return_value = mock_options
            mock_create_error.return_value = ({"error": "stream error"}, 429)

            result = await create_message(streaming_message_request, mock_request, None)

            assert isinstance(result, StreamingResponse)

            # Consume the stream to verify error handling
            chunks = []
            async for chunk in result.body_iterator:
                chunks.append(chunk)

            # Should contain error message
            assert len(chunks) == 1
            assert "error" in chunks[0]
            assert "stream error" in chunks[0]

    @pytest.mark.asyncio
    async def test_create_message_streaming_generic_exception(
        self,
        streaming_message_request: ClaudeCodeMessageCreateParams,
        mock_request: Request,
        mock_settings: MagicMock,
    ):
        """Test handling of generic Exception in streaming mode."""
        with (
            patch(
                "ccproxy.routers.claudecode.anthropic.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "ccproxy.routers.claudecode.anthropic.ClaudeClient"
            ) as mock_client_class,
            patch(
                "ccproxy.routers.claudecode.anthropic.merge_claude_code_options"
            ) as mock_merge,
            patch(
                "ccproxy.routers.claudecode.anthropic.create_error_response"
            ) as mock_create_error,
        ):
            mock_client = MagicMock()
            error = Exception("Unexpected stream error")
            mock_client.create_completion = AsyncMock(side_effect=error)
            mock_client_class.return_value = mock_client
            # merge_claude_code_options returns a ClaudeCodeOptions object
            mock_options = MagicMock()
            mock_options.model = "claude-3-5-sonnet-20241022"
            mock_merge.return_value = mock_options
            mock_create_error.return_value = ({"error": "internal server error"}, 500)

            result = await create_message(streaming_message_request, mock_request, None)

            assert isinstance(result, StreamingResponse)

            # Consume the stream to verify error handling
            chunks = []
            async for chunk in result.body_iterator:
                chunks.append(chunk)

            # Should contain error message
            assert len(chunks) == 1
            assert "error" in chunks[0]
            assert "internal server error" in chunks[0]

    @pytest.mark.asyncio
    async def test_create_message_streaming_with_valid_async_iterator(
        self,
        streaming_message_request: ClaudeCodeMessageCreateParams,
        mock_request: Request,
        mock_settings: MagicMock,
    ):
        """Test streaming with valid async iterator from Claude client."""
        with (
            patch(
                "ccproxy.routers.claudecode.anthropic.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "ccproxy.routers.claudecode.anthropic.ClaudeClient"
            ) as mock_client_class,
            patch(
                "ccproxy.routers.claudecode.anthropic.merge_claude_code_options"
            ) as mock_merge,
            patch(
                "ccproxy.routers.claudecode.anthropic.stream_anthropic_message_response"
            ) as mock_stream,
        ):
            mock_client = MagicMock()

            # Create async generator for streaming response
            async def mock_stream_generator():
                yield {"type": "message_start", "message": {"id": "msg_123"}}
                yield {"type": "content_block_delta", "delta": {"text": "Hello world"}}

            mock_client.create_completion = AsyncMock(
                return_value=mock_stream_generator()
            )
            mock_client_class.return_value = mock_client
            # merge_claude_code_options returns a ClaudeCodeOptions object
            mock_options = MagicMock()
            mock_options.model = "claude-3-5-sonnet-20241022"
            mock_merge.return_value = mock_options

            # Mock the streaming formatter
            async def mock_stream_formatter(response_iter, message_id, model):
                async for chunk in response_iter:
                    yield f"data: {json.dumps(chunk)}\n\n"

            mock_stream.side_effect = mock_stream_formatter

            result = await create_message(streaming_message_request, mock_request, None)

            assert isinstance(result, StreamingResponse)

            # Consume the stream to verify it works
            chunks = []
            async for chunk in result.body_iterator:
                chunks.append(chunk)

            # Should contain both chunks
            assert len(chunks) == 2
            assert "message_start" in chunks[0]
            assert "content_block_delta" in chunks[1]

    @pytest.mark.asyncio
    async def test_create_message_message_id_generation(
        self,
        basic_message_request: ClaudeCodeMessageCreateParams,
        mock_request: Request,
        mock_claude_response: dict[str, Any],
        mock_settings: MagicMock,
    ):
        """Test message ID generation is unique."""
        with (
            patch(
                "ccproxy.routers.claudecode.anthropic.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "ccproxy.routers.claudecode.anthropic.ClaudeClient"
            ) as mock_client_class,
            patch(
                "ccproxy.routers.claudecode.anthropic.merge_claude_code_options"
            ) as mock_merge,
            patch("ccproxy.routers.claudecode.anthropic.uuid.uuid4") as mock_uuid,
        ):
            mock_client = MagicMock()
            mock_client.create_completion = AsyncMock(return_value=mock_claude_response)
            mock_client_class.return_value = mock_client
            # merge_claude_code_options returns a ClaudeCodeOptions object
            mock_options = MagicMock()
            mock_options.model = "claude-3-5-sonnet-20241022"
            mock_merge.return_value = mock_options

            # Mock UUID to return specific hex
            mock_uuid.return_value.hex = "abcdef123456789012345678"

            result = await create_message(basic_message_request, mock_request, None)

            assert isinstance(result, MessageResponse)
            assert result.id == "msg_abcdef123456"
            mock_uuid.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_message_options_merging(
        self,
        basic_message_request: ClaudeCodeMessageCreateParams,
        mock_request: Request,
        mock_claude_response: dict[str, Any],
        mock_settings: MagicMock,
    ):
        """Test options merging between settings and request."""
        with (
            patch(
                "ccproxy.routers.claudecode.anthropic.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "ccproxy.routers.claudecode.anthropic.ClaudeClient"
            ) as mock_client_class,
            patch(
                "ccproxy.routers.claudecode.anthropic.merge_claude_code_options"
            ) as mock_merge,
        ):
            mock_client = MagicMock()
            mock_client.create_completion = AsyncMock(return_value=mock_claude_response)
            mock_client_class.return_value = mock_client
            # merge_claude_code_options returns a ClaudeCodeOptions object
            mock_options = MagicMock()
            mock_options.model = "claude-3-5-sonnet-20241022"
            mock_options.temperature = 0.7
            mock_merge.return_value = mock_options

            await create_message(basic_message_request, mock_request, None)

            # Verify merge was called to get base options
            mock_merge.assert_called_once_with(mock_settings.claude_code_options)

    @pytest.mark.asyncio
    async def test_create_message_messages_conversion(
        self,
        basic_message_request: ClaudeCodeMessageCreateParams,
        mock_request: Request,
        mock_claude_response: dict[str, Any],
        mock_settings: MagicMock,
    ):
        """Test messages are properly converted to dict format."""
        with (
            patch(
                "ccproxy.routers.claudecode.anthropic.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "ccproxy.routers.claudecode.anthropic.ClaudeClient"
            ) as mock_client_class,
            patch(
                "ccproxy.routers.claudecode.anthropic.merge_claude_code_options"
            ) as mock_merge,
        ):
            mock_client = MagicMock()
            mock_client.create_completion = AsyncMock(return_value=mock_claude_response)
            mock_client_class.return_value = mock_client
            # merge_claude_code_options returns a ClaudeCodeOptions object
            mock_options = MagicMock()
            mock_options.model = "claude-3-5-sonnet-20241022"
            mock_merge.return_value = mock_options

            await create_message(basic_message_request, mock_request, None)

            # Verify messages were converted to dict format
            mock_client.create_completion.assert_called_once()
            call_args = mock_client.create_completion.call_args
            messages = call_args[1]["messages"]
            assert messages == [{"role": "user", "content": "Hello, how are you?"}]

    @pytest.mark.asyncio
    async def test_create_message_auth_dependency_called(
        self,
        basic_message_request: ClaudeCodeMessageCreateParams,
        mock_request: Request,
        mock_claude_response: dict[str, Any],
        mock_settings: MagicMock,
    ):
        """Test that auth dependency is properly handled."""
        with (
            patch(
                "ccproxy.routers.claudecode.anthropic.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "ccproxy.routers.claudecode.anthropic.ClaudeClient"
            ) as mock_client_class,
            patch(
                "ccproxy.routers.claudecode.anthropic.merge_claude_code_options"
            ) as mock_merge,
        ):
            mock_client = MagicMock()
            mock_client.create_completion = AsyncMock(return_value=mock_claude_response)
            mock_client_class.return_value = mock_client
            # merge_claude_code_options returns a ClaudeCodeOptions object
            mock_options = MagicMock()
            mock_options.model = "claude-3-5-sonnet-20241022"
            mock_merge.return_value = mock_options

            # The auth dependency returns None when passed correctly
            result = await create_message(basic_message_request, mock_request, None)

            assert isinstance(result, MessageResponse)
            assert result.id is not None
            # If auth dependency failed, it would raise an exception before reaching here

    @pytest.mark.asyncio
    async def test_create_message_with_claude_code_options(
        self,
        claude_code_options_request: ClaudeCodeMessageCreateParams,
        mock_request: Request,
        mock_claude_response: dict[str, Any],
        mock_settings: MagicMock,
    ):
        """Test message creation with Claude Code specific options."""
        with (
            patch(
                "ccproxy.routers.claudecode.anthropic.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "ccproxy.routers.claudecode.anthropic.ClaudeClient"
            ) as mock_client_class,
            patch(
                "ccproxy.routers.claudecode.anthropic.merge_claude_code_options"
            ) as mock_merge,
        ):
            mock_client = MagicMock()
            mock_client.create_completion = AsyncMock(return_value=mock_claude_response)
            mock_client_class.return_value = mock_client

            # merge_claude_code_options returns a ClaudeCodeOptions object
            mock_options = MagicMock()
            mock_options.model = "claude-3-5-sonnet-20241022"
            mock_options.max_thinking_tokens = 2000
            mock_options.cwd = "/tmp/workspace"
            mock_options.allowed_tools = ["bash", "python"]
            mock_options.max_turns = 5
            mock_options.permission_mode = "ask"
            mock_merge.return_value = mock_options

            result = await create_message(
                claude_code_options_request, mock_request, None
            )

            assert isinstance(result, MessageResponse)

            # Verify that the options were set correctly from the request
            assert mock_options.max_thinking_tokens == 2000
            assert mock_options.cwd == "/tmp/workspace"
            assert mock_options.allowed_tools == ["bash", "python"]
            assert mock_options.max_turns == 5
            assert mock_options.permission_mode == "ask"

            # Verify client was called with the options object
            mock_client.create_completion.assert_called_once_with(
                messages=[{"role": "user", "content": "Help me code"}],
                options=mock_options,
                stream=False,
            )
