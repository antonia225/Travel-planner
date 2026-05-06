# User Interest Categories for LLM Prompts

## Overview

The User Interest system allows travelers to define their preferences across 17 predefined categories. These interests are used to personalize AI-generated travel itineraries, ensuring the LLM produces suggestions aligned with each user's travel style and preferences.

## Interest Categories

### Activity & Adventure
- **adventure**: Hiking, climbing, extreme sports, trekking
- **water_sports**: Diving, surfing, kayaking, snorkeling, water activities
- **nature_wildlife**: Safaris, birdwatching, national parks, wildlife tours

### Culture & Exploration
- **culture_history**: Museums, historical sites, heritage tours, archaeological sites
- **photography**: Photography-focused trips, photo tours, scenic viewpoints
- **spiritual_religious**: Religious sites, meditation retreats, spiritual journeys

### Food & Beverage
- **food_culinary**: Food tours, cooking classes, local cuisine exploration, street food
- **fine_dining**: Upscale restaurants, wine tasting, michelin-starred dining

### Relaxation & Wellness
- **relaxation_wellness**: Spas, yoga retreats, wellness centers, meditation
- **beach**: Beach relaxation, coastal activities, sunbathing, seaside exploration

### Entertainment & Shopping
- **shopping**: Markets, boutiques, local shopping, souvenirs
- **nightlife**: Clubs, bars, live music, nightlife scene
- **entertainment**: Theater, concerts, shows, cultural performances

### Travel Style
- **budget_conscious**: Budget accommodations, cheap eats, budget airlines, hostels
- **luxury**: High-end hotels, premium experiences, private tours, exclusive access
- **eco_tourism**: Sustainable travel, eco-lodges, conservation efforts, responsible tourism
- **family_friendly**: Family activities, kid-friendly venues, playgrounds, educational sites

## API Integration

### Endpoints

#### 1. Get Interest Categories
```
GET /interests/categories
```

Returns all available interest categories with descriptions.

**Response:**
```json
{
  "categories": ["adventure", "water_sports", "nature_wildlife", ...],
  "descriptions": {
    "adventure": "Hiking, climbing, extreme sports",
    ...
  }
}
```

#### 2. Get User Profile with Interests
```
GET /me
Authorization: Bearer <token>
```

Returns current user's profile including their selected interests.

**Response:**
```json
{
  "id": 1,
  "name": "Jane Doe",
  "email": "jane@example.com",
  "interests": ["adventure", "food_culinary", "culture_history"]
}
```

#### 3. Update User Interests
```
PUT /me/interests
Authorization: Bearer <token>

{
  "interests": ["adventure", "food_culinary", "culture_history"]
}
```

Returns the updated user profile.

## LLM Prompt Integration

When generating itineraries, interests are incorporated into the prompt as follows:

```
Generate a detailed 5-day travel itinerary for Barcelona. The traveler is 
interested in: adventure, food_culinary, culture_history. Prioritize activities 
aligned with these interests. Remember: output only the raw JSON, no markdown, 
no extra text.
```

The LLM uses these interests to:
- Prioritize activities matching user preferences
- Filter out irrelevant attractions
- Suggest specialized tours and experiences
- Adjust activity intensity and style
- Recommend appropriate dining establishments

## Frontend Implementation

### Steps for Users to Set Interests

1. **View Available Categories**
   - Fetch all categories from `/interests/categories`
   - Display with descriptions for user guidance

2. **Select Interests**
   - Allow users to select multiple interests
   - Visual indicators (checkboxes, chips) for selections

3. **Save Interests**
   - Send selected interests to `PUT /me/interests`
   - Update local state/context
   - Show success confirmation

4. **Personalized Itineraries**
   - When generating itineraries, user's interests are automatically included
   - No additional action needed in `/generate-itinerary`

## Database Schema

```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    interests = Column(JSON, nullable=False, default=list)  # List of interest strings
```

## Design Decisions

1. **Enum-Based Categories**: Uses `InterestCategory` enum to ensure type safety and prevent invalid interest values.

2. **JSON Storage**: Interests are stored as JSON arrays in the database for flexibility and easy querying.

3. **No Forced Selection**: Users can have zero interests (defaults to empty list), allowing iterative profile building.

4. **Extensibility**: New interest categories can be added to `InterestCategory` enum without breaking existing data.

5. **LLM Integration**: Interests are communicated to LLM via natural language in the prompt, allowing the model to interpret context intelligently.

## Example User Flows

### First-Time Setup
1. User registers and logs in
2. Frontend fetches `/interests/categories`
3. User selects interests (e.g., "adventure", "food_culinary")
4. Frontend sends `PUT /me/interests` with selections
5. Interests are saved and shown in profile

### Generating Personalized Itinerary
1. User navigates to itinerary generation
2. User enters destination and duration
3. Frontend calls `POST /generate-itinerary` (interests auto-included from context)
4. Backend passes interests to LLM prompt
5. LLM generates personalized itinerary based on interests

### Updating Interests
1. User visits profile/settings
2. User modifies interest selections
3. Frontend sends `PUT /me/interests` with updated list
4. Future itineraries reflect new preferences

## Testing

Tests are included for:
- ✅ Retrieving interest categories
- ✅ Updating user interests
- ✅ Default empty interests for new users
- ✅ Authentication requirements for protected endpoints

Run tests with:
```bash
python -m pytest backend/tests/test_auth.py::TestInterests -v
```
