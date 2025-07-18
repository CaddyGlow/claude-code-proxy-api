"""Tests for OpenAI model validation edge cases."""

import pytest
from pydantic import ValidationError

from ccproxy.formatters.translator import map_openai_model_to_claude
from ccproxy.models.openai import (
    OpenAIChatCompletionRequest,
    OpenAIMessage,
    OpenAITool,
)


@pytest.mark.unit
class TestOpenAIRequestValidation:
    """Test OpenAI request validation edge cases."""

    def test_empty_messages_validation_error(self) -> None:
        """Test that empty messages list raises validation error."""
        with pytest.raises(ValidationError) as exc_info:
            OpenAIChatCompletionRequest.model_validate(
                {
                    "model": "claude-opus-4-20250514",
                    "messages": [],  # Empty messages should fail - covers line 193
                }
            )

        assert "List should have at least 1 item" in str(exc_info.value)

    def test_custom_messages_validator_empty_list(self) -> None:
        """Test the custom messages validator directly with empty list."""
        from ccproxy.models.openai import OpenAIChatCompletionRequest

        # Call the validator method directly to test line 193
        with pytest.raises(ValueError) as exc_info:
            OpenAIChatCompletionRequest.validate_messages([])

        assert "At least one message is required" in str(exc_info.value)

    def test_stop_string_validation(self) -> None:
        """Test stop parameter validation with string."""
        # Test valid string stop parameter - covers line 201-202
        request = OpenAIChatCompletionRequest.model_validate(
            {
                "model": "claude-opus-4-20250514",
                "messages": [{"role": "user", "content": "Hello"}],
                "stop": "STOP",  # Single string
            }
        )
        assert request.stop == "STOP"

    def test_stop_list_validation(self) -> None:
        """Test stop parameter validation with list."""
        # Test valid list stop parameter - covers line 203-206
        request = OpenAIChatCompletionRequest.model_validate(
            {
                "model": "claude-opus-4-20250514",
                "messages": [{"role": "user", "content": "Hello"}],
                "stop": ["STOP", "END", "QUIT"],  # List of strings
            }
        )
        assert request.stop == ["STOP", "END", "QUIT"]

    def test_stop_list_too_many_validation_error(self) -> None:
        """Test that more than 4 stop sequences raises validation error."""
        with pytest.raises(ValidationError) as exc_info:
            OpenAIChatCompletionRequest.model_validate(
                {
                    "model": "claude-opus-4-20250514",
                    "messages": [{"role": "user", "content": "Hello"}],
                    "stop": [
                        "STOP",
                        "END",
                        "QUIT",
                        "EXIT",
                        "FINISH",
                    ],  # 5 items - covers line 204-205
                }
            )

        assert "Maximum 4 stop sequences allowed" in str(exc_info.value)

    def test_tools_too_many_validation_error(self) -> None:
        """Test that more than 128 tools raises validation error."""
        # Create 129 tools to exceed the limit
        tools = []
        for i in range(129):
            from ccproxy.models.openai import OpenAIFunction

            tools.append(
                OpenAITool(
                    type="function",
                    function=OpenAIFunction(
                        name=f"tool_{i}",
                        description=f"Tool {i}",
                        parameters={"type": "object", "properties": {}},
                    ),
                )
            )

        with pytest.raises(ValidationError) as exc_info:
            OpenAIChatCompletionRequest.model_validate(
                {
                    "model": "claude-opus-4-20250514",
                    "messages": [{"role": "user", "content": "Hello"}],
                    "tools": [
                        tool.model_dump() for tool in tools
                    ],  # 129 tools - covers line 214
                }
            )

        assert "Maximum 128 tools allowed" in str(exc_info.value)

    def test_tools_exactly_128_allowed(self) -> None:
        """Test that exactly 128 tools is allowed."""
        # Create exactly 128 tools (at the limit)
        tools = []
        for i in range(128):
            from ccproxy.models.openai import OpenAIFunction

            tools.append(
                OpenAITool(
                    type="function",
                    function=OpenAIFunction(
                        name=f"tool_{i}",
                        description=f"Tool {i}",
                        parameters={"type": "object", "properties": {}},
                    ),
                )
            )

        # This should not raise an error
        request = OpenAIChatCompletionRequest.model_validate(
            {
                "model": "claude-opus-4-20250514",
                "messages": [{"role": "user", "content": "Hello"}],
                "tools": [tool.model_dump() for tool in tools],  # Exactly 128 tools
            }
        )
        assert request.tools is not None and len(request.tools) == 128

    def test_stop_none_validation(self) -> None:
        """Test that None stop parameter is allowed."""
        request = OpenAIChatCompletionRequest.model_validate(
            {
                "model": "claude-opus-4-20250514",
                "messages": [{"role": "user", "content": "Hello"}],
                "stop": None,  # None should be allowed - covers line 207
            }
        )
        assert request.stop is None

    def test_tools_none_validation(self) -> None:
        """Test that None tools parameter is allowed."""
        request = OpenAIChatCompletionRequest.model_validate(
            {
                "model": "claude-opus-4-20250514",
                "messages": [{"role": "user", "content": "Hello"}],
                "tools": None,  # None should be allowed
            }
        )
        assert request.tools is None

    def test_deprecated_function_fields(self) -> None:
        """Test that deprecated function fields are accepted for backward compatibility."""
        request = OpenAIChatCompletionRequest.model_validate(
            {
                "model": "claude-opus-4-20250514",
                "messages": [{"role": "user", "content": "Hello"}],
                "functions": [
                    {
                        "name": "get_weather",
                        "description": "Get weather info",
                        "parameters": {"type": "object", "properties": {}},
                    }
                ],
                "function_call": "auto",
            }
        )
        assert request.functions is not None
        assert len(request.functions) == 1
        assert request.function_call == "auto"

    def test_response_format_json_schema(self) -> None:
        """Test response_format with json_schema type."""
        from ccproxy.models.openai import OpenAIResponseFormat

        # Test valid json_schema format
        response_format = OpenAIResponseFormat.model_validate(
            {
                "type": "json_schema",
                "json_schema": {
                    "name": "weather_response",
                    "schema": {
                        "type": "object",
                        "properties": {
                            "temperature": {"type": "number"},
                            "unit": {"type": "string"},
                        },
                        "required": ["temperature", "unit"],
                    },
                },
            }
        )
        assert response_format.type == "json_schema"
        assert response_format.json_schema is not None
        assert response_format.json_schema["name"] == "weather_response"

    def test_response_format_json_schema_validation_error(self) -> None:
        """Test that json_schema type without schema raises validation error."""
        from ccproxy.models.openai import OpenAIResponseFormat

        with pytest.raises(ValidationError) as exc_info:
            OpenAIResponseFormat.model_validate(
                {
                    "type": "json_schema",
                    # Missing json_schema field
                }
            )
        assert "json_schema must be provided when type is 'json_schema'" in str(
            exc_info.value
        )

    def test_response_format_json_object_with_schema_error(self) -> None:
        """Test that json_object type with schema raises validation error."""
        from ccproxy.models.openai import OpenAIResponseFormat

        with pytest.raises(ValidationError) as exc_info:
            OpenAIResponseFormat.model_validate(
                {
                    "type": "json_object",
                    "json_schema": {"some": "schema"},  # Should not be allowed
                }
            )
        assert "json_schema should only be provided when type is 'json_schema'" in str(
            exc_info.value
        )

    def test_multimodal_fields(self) -> None:
        """Test multimodal fields in request."""
        request = OpenAIChatCompletionRequest.model_validate(
            {
                "model": "claude-opus-4-20250514",
                "messages": [{"role": "user", "content": "Hello"}],
                "modalities": ["text", "audio"],
                "audio": {
                    "voice": "alloy",
                    "format": "mp3",
                },
            }
        )
        assert request.modalities == ["text", "audio"]
        assert request.audio is not None
        assert request.audio["voice"] == "alloy"

    def test_store_and_metadata_fields(self) -> None:
        """Test store and metadata fields."""
        request = OpenAIChatCompletionRequest.model_validate(
            {
                "model": "claude-opus-4-20250514",
                "messages": [{"role": "user", "content": "Hello"}],
                "store": True,
                "metadata": {
                    "user_id": "12345",
                    "session_id": "abc-def-ghi",
                    "custom_field": "value",
                },
            }
        )
        assert request.store is True
        assert request.metadata is not None
        assert request.metadata["user_id"] == "12345"
        assert request.metadata["session_id"] == "abc-def-ghi"


@pytest.mark.unit
class TestOpenAIResponseGeneration:
    """Test OpenAI response generation edge cases."""

    def test_create_response_factory_method(self) -> None:
        """Test the create class method for generating responses."""
        from ccproxy.models.openai import OpenAIChatCompletionResponse

        # Test the factory method - covers line 337
        response = OpenAIChatCompletionResponse.create(
            model="claude-opus-4-20250514",
            content="Hello, world!",
            prompt_tokens=10,
            completion_tokens=5,
            finish_reason="stop",
        )

        assert response.model == "claude-opus-4-20250514"
        assert len(response.choices) == 1
        assert response.choices[0].message.content == "Hello, world!"
        assert response.choices[0].finish_reason == "stop"
        assert response.usage.prompt_tokens == 10
        assert response.usage.completion_tokens == 5
        assert response.usage.total_tokens == 15
        assert response.object == "chat.completion"
        assert response.id.startswith("chatcmpl-")

    def test_create_response_with_tool_calls(self) -> None:
        """Test creating response with tool calls."""
        from ccproxy.models.openai import (
            OpenAIChatCompletionResponse,
            OpenAIFunctionCall,
            OpenAIToolCall,
        )

        tool_calls = [
            OpenAIToolCall(
                id="call_123",
                type="function",
                function=OpenAIFunctionCall(
                    name="get_weather",
                    arguments='{"location": "New York"}',
                ),
            )
        ]

        response = OpenAIChatCompletionResponse.create(
            model="claude-opus-4-20250514",
            content="I'll check the weather for you.",
            prompt_tokens=15,
            completion_tokens=8,
            finish_reason="tool_calls",
            tool_calls=tool_calls,
        )

        assert response.choices[0].finish_reason == "tool_calls"
        assert response.choices[0].message.tool_calls is not None
        assert len(response.choices[0].message.tool_calls) == 1
        assert response.choices[0].message.tool_calls[0].function.name == "get_weather"


@pytest.mark.unit
class TestOpenAIModelMapping:
    """Test OpenAI to Claude model mapping functionality."""

    def test_map_gpt4o_mini_to_haiku(self) -> None:
        """Test mapping gpt-4o-mini to claude-3-5-haiku-latest."""
        result = map_openai_model_to_claude("gpt-4o-mini")
        assert result == "claude-3-5-haiku-latest"

    def test_map_o3_mini_to_opus(self) -> None:
        """Test mapping o3-mini to claude-opus-4-20250514."""
        result = map_openai_model_to_claude("o3-mini")
        assert result == "claude-opus-4-20250514"

    def test_map_o1_mini_to_sonnet(self) -> None:
        """Test mapping o1-mini to claude-sonnet-4-20250514."""
        result = map_openai_model_to_claude("o1-mini")
        assert result == "claude-sonnet-4-20250514"

    def test_map_gpt4o_to_sonnet_37(self) -> None:
        """Test mapping gpt-4o to claude-3-7-sonnet-20250219."""
        result = map_openai_model_to_claude("gpt-4o")
        assert result == "claude-3-7-sonnet-20250219"

    def test_startswith_matching_gpt4o_variants(self) -> None:
        """Test startswith matching for gpt-4o variants."""
        result = map_openai_model_to_claude("gpt-4o-2024-05-13")
        assert result == "claude-3-7-sonnet-20250219"

        result = map_openai_model_to_claude("gpt-4o-preview")
        assert result == "claude-3-7-sonnet-20250219"

    def test_startswith_matching_gpt4o_mini_variants(self) -> None:
        """Test startswith matching for gpt-4o-mini variants."""
        result = map_openai_model_to_claude("gpt-4o-mini-2024-07-18")
        assert result == "claude-3-5-haiku-latest"

    def test_claude_models_pass_through(self) -> None:
        """Test that Claude models pass through without mapping."""
        claude_models = [
            "claude-opus-4-20250514",
            "claude-sonnet-4-20250514",
            "claude-3-7-sonnet-20250219",
            "claude-3-5-sonnet-20241022",
            "claude-3-5-haiku-20241022",
        ]

        for model in claude_models:
            result = map_openai_model_to_claude(model)
            assert result == model

    def test_unknown_model_pass_through(self) -> None:
        """Test that unknown models pass through unchanged."""
        unknown_models = [
            "unknown-model",
            "custom-model-v1",
            "my-fine-tuned-model",
        ]

        for model in unknown_models:
            result = map_openai_model_to_claude(model)
            assert result == model

    def test_exact_match_takes_precedence(self) -> None:
        """Test that exact matches take precedence over startswith matches."""
        # gpt-4o should map to claude-3-7-sonnet-20250219 even though
        # gpt-4o-mini would also match the startswith for gpt-4o
        result = map_openai_model_to_claude("gpt-4o")
        assert result == "claude-3-7-sonnet-20250219"

    def test_mapping_in_translator_request(self) -> None:
        """Test model mapping integration in translator."""
        from ccproxy.formatters.translator import OpenAITranslator

        translator = OpenAITranslator()
        openai_request = {
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": "Hello"}],
            "max_tokens": 100,
        }

        anthropic_request = translator.openai_to_anthropic_request(openai_request)
        assert anthropic_request["model"] == "claude-3-5-haiku-latest"
