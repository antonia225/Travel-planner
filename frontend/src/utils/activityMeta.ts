export type ActivityCategoryKey =
  | "dining"
  | "sightseeing"
  | "transit"
  | "flight"
  | "stay"
  | "cafe"
  | "outdoor"
  | "shopping"
  | "entertainment"
  | "explore"
  | "activity";

export type ActivityLike = {
  title?: string;
  description?: string;
};

export type ActivityCategoryMeta = {
  key: ActivityCategoryKey;
  label: string;
};

export function inferActivityCategoryMeta(
  activity: ActivityLike
): ActivityCategoryMeta {
  const text = `${activity.title ?? ""} ${
    activity.description ?? ""
  }`.toLowerCase();

  if (/restaurant|dinner|lunch|breakfast|food|dining|meal|bistro|cafe|bar/.test(text)) {
    return { key: "dining", label: "Dining" };
  }

  if (/museum|monument|landmark|temple|cathedral|castle|palace|galler(y|ies)|historic|louvre/.test(text)) {
    return { key: "sightseeing", label: "Sightseeing" };
  }

  if (/train|metro|subway|rail|station/.test(text)) {
    return { key: "transit", label: "Transit" };
  }

  if (/car|taxi|drive|transfer|bus|transport|arrival|depart/.test(text)) {
    return { key: "transit", label: "Transit" };
  }

  if (/flight|airport|plane/.test(text)) {
    return { key: "flight", label: "Flight" };
  }

  if (/hotel|check-in|check in|stay|accommodation/.test(text)) {
    return { key: "stay", label: "Stay" };
  }

  if (/coffee|tea|bakery|brunch/.test(text)) {
    return { key: "cafe", label: "Cafe" };
  }

  if (/park|garden|hike|nature|beach|trail/.test(text)) {
    return { key: "outdoor", label: "Outdoor" };
  }

  if (/shop|market|souvenir|mall/.test(text)) {
    return { key: "shopping", label: "Shopping" };
  }

  if (/show|concert|music|theater|nightlife/.test(text)) {
    return { key: "entertainment", label: "Entertainment" };
  }

  if (/photo|view|scenic|walk|tour/.test(text)) {
    return { key: "explore", label: "Explore" };
  }

  return { key: "activity", label: "Activity" };
}
