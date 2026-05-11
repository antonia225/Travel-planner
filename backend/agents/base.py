"""Abstract base class for travel AI agents."""

from abc import ABC, abstractmethod


class TravelAIAgent(ABC):
    """Abstract base class for all travel AI agents."""

    @abstractmethod
    def generate(self, prompt: str) -> str:
        """
        Generate a response to the given prompt.

        Args:
            prompt: The user's input prompt

        Returns:
            str: The generated response

        Raises:
            ValueError: If prompt is empty or invalid
        """
        pass
