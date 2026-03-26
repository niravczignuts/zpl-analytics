// ZPL 2025 price database — ground truth for auction AI
// Players NOT in this list = "New Player — No ZPL 2025 record"

export interface ZPL2025Record {
  price: number;   // in Lakhs
  team: string;
  group: number | null;
}

export const ZPL_2025_DB: Record<string, ZPL2025Record> = {
  "nihar bhatt":           { price: 37.5, team: "Trojan Horse",    group: 2 },
  "apeksha raval":         { price: 15.0, team: "Trojan Horse",    group: null },
  "mushrat saiyad":        { price: 4.5,  team: "Trojan Horse",    group: null },
  "ravi jagani":           { price: 66.0, team: "Trojan Horse",    group: 1 },
  "pratham pathak":        { price: 34.0, team: "Trojan Horse",    group: 3 },
  "vivek yadav":           { price: 7.5,  team: "Trojan Horse",    group: null },
  "ravi thakor":           { price: 37.5, team: "Trojan Horse",    group: 2 },
  "jasrajsinh jethwa":     { price: 15.0, team: "Trojan Horse",    group: 4 },
  "jay patel":             { price: 26.5, team: "Trojan Horse",    group: null },
  "chetan singadia":       { price: 1.0,  team: "Trojan Horse",    group: null },
  "parth dabhi":           { price: 1.0,  team: "Trojan Horse",    group: null },
  "karan bharakhda":       { price: 1.0,  team: "Trojan Horse",    group: null },
  "ishan bramhbhatt":      { price: 31.5, team: "The Mavericks",   group: 1 },
  "rinkal patel":          { price: 33.0, team: "The Mavericks",   group: null },
  "rushita vagasiya":      { price: 2.0,  team: "The Mavericks",   group: null },
  "vishvam shah":          { price: 12.0, team: "The Mavericks",   group: 3 },
  "vaibhav parmar":        { price: 16.5, team: "The Mavericks",   group: 3 },
  "naitik vala":           { price: 5.5,  team: "The Mavericks",   group: null },
  "vishal gadhiya":        { price: 31.5, team: "The Mavericks",   group: 2 },
  "ashish kumar patel":    { price: 20.5, team: "The Mavericks",   group: 3 },
  "ankit pithiya":         { price: 20.5, team: "The Mavericks",   group: 3 },
  "jaychand maurya":       { price: 17.5, team: "The Mavericks",   group: 3 },
  "dhrumil amrutiya":      { price: 22.5, team: "The Mavericks",   group: 3 },
  "harsh kanzariya":       { price: 1.0,  team: "The Mavericks",   group: null },
  "parth trivedi":         { price: 63.0, team: "Marvel Monsters", group: 2 },
  "drashti kapatel":       { price: 4.5,  team: "Marvel Monsters", group: null },
  "ruhi kansagara":        { price: 9.5,  team: "Marvel Monsters", group: null },
  "divyesh mepal":         { price: 49.5, team: "Marvel Monsters", group: 2 },
  "aman tiwari":           { price: 16.5, team: "Marvel Monsters", group: 3 },
  "smit soni":             { price: 5.5,  team: "Marvel Monsters", group: null },
  "lovesh chaudhari":      { price: 63.0, team: "Marvel Monsters", group: 2 },
  "nisarg chhaniyara":     { price: 13.5, team: "Marvel Monsters", group: 3 },
  "srivasanth jammula":    { price: 1.5,  team: "Marvel Monsters", group: null },
  "divyesh lagadhir":      { price: 1.5,  team: "Marvel Monsters", group: null },
  "vraj makvana":          { price: 1.0,  team: "Marvel Monsters", group: null },
  "keyur vadagama":        { price: 1.0,  team: "Marvel Monsters", group: null },
  "gunjan kalariya":       { price: 14.0, team: "Red Squad",       group: 3 },
  "keyuri patel":          { price: 1.5,  team: "Red Squad",       group: null },
  "shreya patel":          { price: 22.0, team: "Red Squad",       group: null },
  "harsh raghavani":       { price: 85.5, team: "Red Squad",       group: 1 },
  "akash singh":           { price: 1.5,  team: "Red Squad",       group: 4 },
  "ketan kandoriya":       { price: 1.5,  team: "Red Squad",       group: null },
  "neel joshi":            { price: 50.5, team: "Red Squad",       group: 2 },
  "darshan vanol":         { price: 31.5, team: "Red Squad",       group: 2 },
  "sarju dharsandiya":     { price: 14.0, team: "Red Squad",       group: 3 },
  "kishan modi":           { price: 25.5, team: "Red Squad",       group: null },
  "mukhtar suthar":        { price: 1.0,  team: "Red Squad",       group: null },
  "deep mistry":           { price: 1.0,  team: "Red Squad",       group: null },
  "nirav chaudhari":       { price: 31.0, team: "Super Smashers",  group: 2 },
  "visha patel":           { price: 18.5, team: "Super Smashers",  group: null },
  "drashti mitaliya":      { price: 1.0,  team: "Super Smashers",  group: null },
  "tejas patel":           { price: 26.0, team: "Super Smashers",  group: 2 },
  "ravi patel":            { price: 31.0, team: "Super Smashers",  group: 2 },
  "jeet matalia":          { price: 16.0, team: "Super Smashers",  group: 3 },
  "chirag sharma":         { price: 33.5, team: "Super Smashers",  group: null },
  "parth gupta":           { price: 75.5, team: "Super Smashers",  group: 1 },
  "rutvik malaviya":       { price: 1.5,  team: "Super Smashers",  group: null },
  "rohit parmar":          { price: 7.5,  team: "Super Smashers",  group: null },
  "rohit vispute":         { price: 1.0,  team: "Super Smashers",  group: null },
  "utsav darji":           { price: 1.0,  team: "Super Smashers",  group: null },
  "rahul joshi":           { price: 57.5, team: "Star Strikers",   group: 1 },
  "urmila sondarva":       { price: 5.0,  team: "Star Strikers",   group: null },
  "nidhi bavadiya":        { price: 2.5,  team: "Star Strikers",   group: null },
  "a venkata":             { price: 18.0, team: "Star Strikers",   group: 3 },
  "harsh mistry":          { price: 14.5, team: "Star Strikers",   group: 3 },
  "jatin kantariya":       { price: 28.0, team: "Star Strikers",   group: null },
  "sarthak rakholiya":     { price: 57.5, team: "Star Strikers",   group: 2 },
  "virang kori":           { price: 16.5, team: "Star Strikers",   group: 3 },
  "dhruv kakadiya":        { price: 22.5, team: "Star Strikers",   group: 3 },
  "khush jadvani":         { price: 1.0,  team: "Star Strikers",   group: null },
  "sarman dasa":           { price: 1.0,  team: "Star Strikers",   group: null },
  "soujanya patra":        { price: 1.0,  team: "Star Strikers",   group: null },
  "divyesh patel":         { price: 20.5, team: "Gray Mighty",     group: 3 },
  "rakhee singh":          { price: 4.0,  team: "Gray Mighty",     group: null },
  "zalak maheshwari":      { price: 5.0,  team: "Gray Mighty",     group: null },
  "dharmik dodiya":        { price: 47.5, team: "Gray Mighty",     group: 2 },
  "hardik patel":          { price: 16.0, team: "Gray Mighty",     group: null },
  "md danish":             { price: 71.5, team: "Gray Mighty",     group: 1 },
  "vihang patel":          { price: 20.5, team: "Gray Mighty",     group: 4 },
  "kevin barot":           { price: 37.0, team: "Gray Mighty",     group: null },
  "mangesh vasekar":       { price: 8.5,  team: "Gray Mighty",     group: null },
  "meet shastri":          { price: 1.0,  team: "Gray Mighty",     group: null },
  "shubham brahmbhatt":    { price: 1.0,  team: "Gray Mighty",     group: null },
  "himanshu amin":         { price: 1.0,  team: "Gray Mighty",     group: null },
  "harsh chauhan":         { price: 33.5, team: "The Tech Titans", group: 2 },
  "saloni doshi":          { price: 13.5, team: "The Tech Titans", group: null },
  "kajal mandal":          { price: 1.0,  team: "The Tech Titans", group: null },
  "shobhit shrivastava":   { price: 33.5, team: "The Tech Titans", group: 2 },
  "abhishek chavda":       { price: 9.5,  team: "The Tech Titans", group: 3 },
  "deepak maurya":         { price: 1.5,  team: "The Tech Titans", group: 4 },
  "raviraj chhasatiya":    { price: 75.5, team: "The Tech Titans", group: 1 },
  "vishnu kerasiya":       { price: 1.5,  team: "The Tech Titans", group: null },
  "bhavin prajapati":      { price: 37.5, team: "The Tech Titans", group: null },
  "hari malam":            { price: 1.0,  team: "The Tech Titans", group: null },
  "ravi raj":              { price: 1.0,  team: "The Tech Titans", group: null },
  "hard trivedi":          { price: 1.0,  team: "The Tech Titans", group: null },
};

/** Players that went UNSOLD in ZPL 2025 — treat as risky/unproven */
export const UNSOLD_2025 = new Set(['sarman dasa', 'yash kansagra', 'deep mistry']);

/**
 * Lookup a player's ZPL 2025 price record.
 * Returns null if the player was not in ZPL 2025 (new player).
 */
export function getZPL2025Price(playerName: string): ZPL2025Record | null {
  const key = playerName.trim().toLowerCase();
  return ZPL_2025_DB[key] || null;
}

/**
 * Returns a display string for player cards.
 * e.g. "ZPL 2025: ₹37.5L — Trojan Horse" or "ZPL 2025: New Player"
 */
export function formatZPL2025Display(playerName: string): string {
  const rec = getZPL2025Price(playerName);
  if (!rec) return 'New Player';
  return `₹${rec.price}L — ${rec.team}`;
}
