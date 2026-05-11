"""Mock AI agent for testing and development."""

from agents.base import TravelAIAgent


class MockTravelAIAgent(TravelAIAgent):
    """Mock implementation of TravelAIAgent for testing and development."""

    def generate(self, prompt: str) -> str:
        """
        Generate a mock travel plan response.

        Args:
            prompt: The user's input prompt

        Returns:
            str: A mock travel plan response

        Raises:
            ValueError: If prompt is empty
        """
        if not prompt or not prompt.strip():
            raise ValueError("Prompt cannot be empty")

        return f"Mock travel plan generated for prompt: {prompt}"
