"""AI services for travel planning."""

from agents.factory import AIAgentFactory


def generate_travel_plan(user_prompt: str) -> str:
    """
    Generate a travel plan based on user input.

    Args:
        user_prompt: The user's travel planning request

    Returns:
        str: A generated travel plan

    Raises:
        ValueError: If user_prompt is empty
        ConnectionError: If AI agent cannot connect to its backend service
    """
    if not user_prompt or not user_prompt.strip():
        raise ValueError("Prompt cannot be empty")

    agent = AIAgentFactory.create_agent()
    return agent.generate(user_prompt)

