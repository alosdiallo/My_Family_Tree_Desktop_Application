// country-data.js — Maps country/region names to approximate lat/lng
// Used by the map view to place pins. Coordinates are approximate country centers.
// Also maps common place names, states, and cities to their country.

var COUNTRY_COORDS = {
  "afghanistan": { lat: 33, lng: 65, name: "Afghanistan" },
  "albania": { lat: 41, lng: 20, name: "Albania" },
  "algeria": { lat: 28, lng: 3, name: "Algeria" },
  "argentina": { lat: -34, lng: -64, name: "Argentina" },
  "armenia": { lat: 40, lng: 45, name: "Armenia" },
  "australia": { lat: -25, lng: 134, name: "Australia" },
  "austria": { lat: 47.3, lng: 13.3, name: "Austria" },
  "bangladesh": { lat: 24, lng: 90, name: "Bangladesh" },
  "belarus": { lat: 53, lng: 28, name: "Belarus" },
  "belgium": { lat: 50.5, lng: 4.5, name: "Belgium" },
  "benin": { lat: 9.3, lng: 2.3, name: "Benin" },
  "bolivia": { lat: -17, lng: -65, name: "Bolivia" },
  "bosnia": { lat: 44, lng: 17.8, name: "Bosnia and Herzegovina" },
  "botswana": { lat: -22, lng: 24, name: "Botswana" },
  "brazil": { lat: -10, lng: -55, name: "Brazil" },
  "bulgaria": { lat: 42.7, lng: 25.5, name: "Bulgaria" },
  "burkina faso": { lat: 12.3, lng: -1.5, name: "Burkina Faso" },
  "burundi": { lat: -3.4, lng: 29.9, name: "Burundi" },
  "cambodia": { lat: 13, lng: 105, name: "Cambodia" },
  "cameroon": { lat: 6, lng: 12.5, name: "Cameroon" },
  "canada": { lat: 56, lng: -96, name: "Canada" },
  "chad": { lat: 15.5, lng: 19, name: "Chad" },
  "chile": { lat: -35, lng: -71, name: "Chile" },
  "china": { lat: 35, lng: 105, name: "China" },
  "colombia": { lat: 4, lng: -72, name: "Colombia" },
  "congo": { lat: -1, lng: 15.8, name: "Congo" },
  "costa rica": { lat: 10, lng: -84, name: "Costa Rica" },
  "croatia": { lat: 45.2, lng: 15.5, name: "Croatia" },
  "cuba": { lat: 22, lng: -80, name: "Cuba" },
  "czech republic": { lat: 49.8, lng: 15.5, name: "Czech Republic" },
  "czechia": { lat: 49.8, lng: 15.5, name: "Czech Republic" },
  "denmark": { lat: 56, lng: 10, name: "Denmark" },
  "dominican republic": { lat: 19, lng: -70.7, name: "Dominican Republic" },
  "dr congo": { lat: -2.5, lng: 23.7, name: "DR Congo" },
  "ecuador": { lat: -1.8, lng: -78.2, name: "Ecuador" },
  "egypt": { lat: 26, lng: 30, name: "Egypt" },
  "el salvador": { lat: 13.7, lng: -88.9, name: "El Salvador" },
  "england": { lat: 52.4, lng: -1.2, name: "England" },
  "eritrea": { lat: 15.2, lng: 39.8, name: "Eritrea" },
  "estonia": { lat: 58.6, lng: 25, name: "Estonia" },
  "ethiopia": { lat: 8, lng: 38, name: "Ethiopia" },
  "finland": { lat: 64, lng: 26, name: "Finland" },
  "france": { lat: 46.6, lng: 2.2, name: "France" },
  "gabon": { lat: -0.8, lng: 11.8, name: "Gabon" },
  "gambia": { lat: 13.5, lng: -15.4, name: "Gambia" },
  "georgia": { lat: 42, lng: 43.5, name: "Georgia" },
  "germany": { lat: 51, lng: 10, name: "Germany" },
  "ghana": { lat: 8, lng: -1.2, name: "Ghana" },
  "greece": { lat: 39, lng: 22, name: "Greece" },
  "guatemala": { lat: 15.5, lng: -90.3, name: "Guatemala" },
  "guinea": { lat: 10.8, lng: -10.9, name: "Guinea" },
  "guinea-bissau": { lat: 12, lng: -15, name: "Guinea-Bissau" },
  "haiti": { lat: 19, lng: -72.3, name: "Haiti" },
  "honduras": { lat: 15, lng: -86.5, name: "Honduras" },
  "hungary": { lat: 47.2, lng: 19.5, name: "Hungary" },
  "iceland": { lat: 65, lng: -18, name: "Iceland" },
  "india": { lat: 22, lng: 79, name: "India" },
  "indonesia": { lat: -5, lng: 120, name: "Indonesia" },
  "iran": { lat: 32, lng: 53, name: "Iran" },
  "iraq": { lat: 33.2, lng: 43.7, name: "Iraq" },
  "ireland": { lat: 53.4, lng: -8, name: "Ireland" },
  "israel": { lat: 31.5, lng: 34.8, name: "Israel" },
  "italy": { lat: 42.5, lng: 12.5, name: "Italy" },
  "ivory coast": { lat: 7.5, lng: -5.5, name: "Ivory Coast" },
  "cote d'ivoire": { lat: 7.5, lng: -5.5, name: "Ivory Coast" },
  "jamaica": { lat: 18.1, lng: -77.3, name: "Jamaica" },
  "japan": { lat: 36, lng: 138, name: "Japan" },
  "jordan": { lat: 31, lng: 36.6, name: "Jordan" },
  "kazakhstan": { lat: 48, lng: 67, name: "Kazakhstan" },
  "kenya": { lat: 0, lng: 37.9, name: "Kenya" },
  "korea": { lat: 36, lng: 128, name: "South Korea" },
  "south korea": { lat: 36, lng: 128, name: "South Korea" },
  "north korea": { lat: 40, lng: 127, name: "North Korea" },
  "kuwait": { lat: 29.3, lng: 47.5, name: "Kuwait" },
  "laos": { lat: 18, lng: 105, name: "Laos" },
  "latvia": { lat: 57, lng: 24.1, name: "Latvia" },
  "lebanon": { lat: 33.9, lng: 35.9, name: "Lebanon" },
  "liberia": { lat: 6.4, lng: -9.4, name: "Liberia" },
  "libya": { lat: 27, lng: 17, name: "Libya" },
  "lithuania": { lat: 55.2, lng: 24, name: "Lithuania" },
  "luxembourg": { lat: 49.8, lng: 6.1, name: "Luxembourg" },
  "madagascar": { lat: -19, lng: 47, name: "Madagascar" },
  "malawi": { lat: -13.3, lng: 34.3, name: "Malawi" },
  "malaysia": { lat: 4, lng: 109.5, name: "Malaysia" },
  "mali": { lat: 17.6, lng: -4, name: "Mali" },
  "mauritania": { lat: 20, lng: -10.9, name: "Mauritania" },
  "mexico": { lat: 23.6, lng: -102.6, name: "Mexico" },
  "mongolia": { lat: 47, lng: 103, name: "Mongolia" },
  "morocco": { lat: 31.8, lng: -7, name: "Morocco" },
  "mozambique": { lat: -18.7, lng: 35.5, name: "Mozambique" },
  "myanmar": { lat: 19.8, lng: 96, name: "Myanmar" },
  "namibia": { lat: -22, lng: 17, name: "Namibia" },
  "nepal": { lat: 28.4, lng: 84.1, name: "Nepal" },
  "netherlands": { lat: 52.1, lng: 5.3, name: "Netherlands" },
  "holland": { lat: 52.1, lng: 5.3, name: "Netherlands" },
  "new zealand": { lat: -42, lng: 174, name: "New Zealand" },
  "nicaragua": { lat: 13, lng: -85.2, name: "Nicaragua" },
  "niger": { lat: 17.6, lng: 8, name: "Niger" },
  "nigeria": { lat: 9, lng: 8, name: "Nigeria" },
  "norway": { lat: 64, lng: 12, name: "Norway" },
  "oman": { lat: 21, lng: 57, name: "Oman" },
  "pakistan": { lat: 30.4, lng: 69.3, name: "Pakistan" },
  "palestine": { lat: 31.9, lng: 35.2, name: "Palestine" },
  "panama": { lat: 9, lng: -79.5, name: "Panama" },
  "paraguay": { lat: -23.4, lng: -58.4, name: "Paraguay" },
  "peru": { lat: -10, lng: -76, name: "Peru" },
  "philippines": { lat: 12, lng: 122, name: "Philippines" },
  "poland": { lat: 52, lng: 20, name: "Poland" },
  "portugal": { lat: 39.4, lng: -8.2, name: "Portugal" },
  "qatar": { lat: 25.3, lng: 51.2, name: "Qatar" },
  "romania": { lat: 46, lng: 25, name: "Romania" },
  "russia": { lat: 60, lng: 100, name: "Russia" },
  "rwanda": { lat: -1.9, lng: 29.9, name: "Rwanda" },
  "saudi arabia": { lat: 24, lng: 45, name: "Saudi Arabia" },
  "scotland": { lat: 56.5, lng: -4, name: "Scotland" },
  "senegal": { lat: 14.5, lng: -14.5, name: "Senegal" },
  "serbia": { lat: 44.8, lng: 20.5, name: "Serbia" },
  "sierra leone": { lat: 8.5, lng: -11.8, name: "Sierra Leone" },
  "singapore": { lat: 1.4, lng: 103.8, name: "Singapore" },
  "slovakia": { lat: 48.7, lng: 19.7, name: "Slovakia" },
  "slovenia": { lat: 46, lng: 15, name: "Slovenia" },
  "somalia": { lat: 6, lng: 46, name: "Somalia" },
  "south africa": { lat: -29, lng: 25, name: "South Africa" },
  "south sudan": { lat: 7, lng: 30, name: "South Sudan" },
  "spain": { lat: 40, lng: -4, name: "Spain" },
  "sri lanka": { lat: 7.9, lng: 80.8, name: "Sri Lanka" },
  "sudan": { lat: 15.4, lng: 30.2, name: "Sudan" },
  "sweden": { lat: 62, lng: 15, name: "Sweden" },
  "switzerland": { lat: 46.8, lng: 8.2, name: "Switzerland" },
  "syria": { lat: 35, lng: 38.7, name: "Syria" },
  "taiwan": { lat: 23.7, lng: 121, name: "Taiwan" },
  "tanzania": { lat: -6.4, lng: 34.9, name: "Tanzania" },
  "thailand": { lat: 15.9, lng: 101, name: "Thailand" },
  "togo": { lat: 8.6, lng: 1.2, name: "Togo" },
  "trinidad": { lat: 10.4, lng: -61.2, name: "Trinidad and Tobago" },
  "tunisia": { lat: 34, lng: 9, name: "Tunisia" },
  "turkey": { lat: 39, lng: 35, name: "Turkey" },
  "turkiye": { lat: 39, lng: 35, name: "Turkey" },
  "uganda": { lat: 1.4, lng: 32.3, name: "Uganda" },
  "ukraine": { lat: 49, lng: 32, name: "Ukraine" },
  "united arab emirates": { lat: 24, lng: 54, name: "UAE" },
  "uae": { lat: 24, lng: 54, name: "UAE" },
  "united kingdom": { lat: 54, lng: -2, name: "United Kingdom" },
  "uk": { lat: 54, lng: -2, name: "United Kingdom" },
  "great britain": { lat: 54, lng: -2, name: "United Kingdom" },
  "britain": { lat: 54, lng: -2, name: "United Kingdom" },
  "united states": { lat: 39, lng: -98, name: "United States" },
  "united states of america": { lat: 39, lng: -98, name: "United States" },
  "usa": { lat: 39, lng: -98, name: "United States" },
  "us": { lat: 39, lng: -98, name: "United States" },
  "america": { lat: 39, lng: -98, name: "United States" },
  "uruguay": { lat: -33, lng: -56, name: "Uruguay" },
  "uzbekistan": { lat: 41, lng: 65, name: "Uzbekistan" },
  "venezuela": { lat: 8, lng: -66, name: "Venezuela" },
  "vietnam": { lat: 16, lng: 106, name: "Vietnam" },
  "wales": { lat: 52.1, lng: -3.6, name: "Wales" },
  "yemen": { lat: 15.6, lng: 48, name: "Yemen" },
  "zambia": { lat: -15, lng: 28.3, name: "Zambia" },
  "zimbabwe": { lat: -19.8, lng: 29.9, name: "Zimbabwe" }
};

// Common US states and cities mapped to USA
var US_PLACES = [
  "alabama","alaska","arizona","arkansas","california","colorado","connecticut",
  "delaware","florida","georgia","hawaii","idaho","illinois","indiana","iowa",
  "kansas","kentucky","louisiana","maine","maryland","massachusetts","michigan",
  "minnesota","mississippi","missouri","montana","nebraska","nevada",
  "new hampshire","new jersey","new mexico","new york","north carolina",
  "north dakota","ohio","oklahoma","oregon","pennsylvania","rhode island",
  "south carolina","south dakota","tennessee","texas","utah","vermont",
  "virginia","washington","west virginia","wisconsin","wyoming",
  "brooklyn","manhattan","queens","bronx","staten island","boston","chicago",
  "los angeles","san francisco","philadelphia","houston","phoenix","dallas",
  "san antonio","detroit","seattle","denver","atlanta","miami","minneapolis",
  "portland","las vegas","new orleans","baltimore","milwaukee","kansas city",
  "st. louis","st louis","pittsburgh","cincinnati","cleveland","columbus",
  "indianapolis","charlotte","nashville","memphis","louisville","richmond",
  "hartford","providence","sacramento","san diego","san jose","austin",
  "fort worth","jacksonville","tampa","orlando","raleigh","durham","norfolk"
];

// Common city-to-country mappings for non-US places
var CITY_COUNTRY = {
  "paris": "france", "lyon": "france", "marseille": "france", "toulouse": "france",
  "london": "united kingdom", "manchester": "united kingdom", "birmingham": "united kingdom",
  "liverpool": "united kingdom", "edinburgh": "scotland", "glasgow": "scotland",
  "dublin": "ireland", "cork": "ireland", "galway": "ireland", "limerick": "ireland", "belfast": "ireland",
  "berlin": "germany", "munich": "germany", "hamburg": "germany", "frankfurt": "germany",
  "rome": "italy", "milan": "italy", "naples": "italy", "venice": "italy", "florence": "italy",
  "madrid": "spain", "barcelona": "spain", "seville": "spain",
  "lisbon": "portugal", "porto": "portugal",
  "amsterdam": "netherlands", "rotterdam": "netherlands",
  "brussels": "belgium", "antwerp": "belgium",
  "vienna": "austria", "zurich": "switzerland", "geneva": "switzerland", "bern": "switzerland",
  "prague": "czech republic", "warsaw": "poland", "krakow": "poland",
  "budapest": "hungary", "bucharest": "romania",
  "athens": "greece", "istanbul": "turkey", "ankara": "turkey",
  "moscow": "russia", "st. petersburg": "russia", "st petersburg": "russia",
  "stockholm": "sweden", "oslo": "norway", "copenhagen": "denmark", "helsinki": "finland",
  "tokyo": "japan", "osaka": "japan", "kyoto": "japan",
  "beijing": "china", "shanghai": "china", "hong kong": "china", "guangzhou": "china",
  "seoul": "south korea", "busan": "south korea",
  "new delhi": "india", "mumbai": "india", "delhi": "india", "kolkata": "india", "chennai": "india", "bangalore": "india",
  "sydney": "australia", "melbourne": "australia", "brisbane": "australia",
  "auckland": "new zealand", "wellington": "new zealand",
  "toronto": "canada", "montreal": "canada", "vancouver": "canada", "ottawa": "canada", "calgary": "canada",
  "mexico city": "mexico", "guadalajara": "mexico", "monterrey": "mexico",
  "sao paulo": "brazil", "rio de janeiro": "brazil", "rio": "brazil", "brasilia": "brazil",
  "buenos aires": "argentina",
  "bogota": "colombia", "medellin": "colombia",
  "lima": "peru", "santiago": "chile",
  "cairo": "egypt", "alexandria": "egypt",
  "lagos": "nigeria", "abuja": "nigeria",
  "nairobi": "kenya", "mombasa": "kenya",
  "johannesburg": "south africa", "cape town": "south africa", "pretoria": "south africa", "durban": "south africa",
  "dakar": "senegal", "saint-louis": "senegal", "thies": "senegal", "thiès": "senegal",
  "accra": "ghana", "kumasi": "ghana",
  "addis ababa": "ethiopia",
  "kampala": "uganda", "dar es salaam": "tanzania",
  "casablanca": "morocco", "rabat": "morocco", "marrakech": "morocco",
  "algiers": "algeria", "tunis": "tunisia", "tripoli": "libya",
  "bamako": "mali", "ouagadougou": "burkina faso", "conakry": "guinea",
  "abidjan": "ivory coast", "lome": "togo", "cotonou": "benin",
  "bangkok": "thailand", "hanoi": "vietnam", "ho chi minh": "vietnam",
  "singapore": "singapore", "kuala lumpur": "malaysia",
  "jakarta": "indonesia", "manila": "philippines",
  "dubai": "united arab emirates", "abu dhabi": "united arab emirates",
  "riyadh": "saudi arabia", "jeddah": "saudi arabia", "mecca": "saudi arabia",
  "tehran": "iran", "baghdad": "iraq", "beirut": "lebanon", "damascus": "syria",
  "jerusalem": "israel", "tel aviv": "israel",
  "havana": "cuba", "kingston": "jamaica", "port-au-prince": "haiti",
  "santo domingo": "dominican republic"
};

// Resolve a place string (country, address, city) to a country entry
function resolveCountry(placeStr) {
  if (!placeStr) return null;
  var text = placeStr.toLowerCase().trim();

  // Direct country match
  if (COUNTRY_COORDS[text]) return COUNTRY_COORDS[text];

  // Check each word/phrase against country names
  var parts = text.split(/[,]+/).map(function(s) { return s.trim(); });
  // Check from right to left (country is usually last)
  for (var i = parts.length - 1; i >= 0; i--) {
    var part = parts[i].toLowerCase();
    if (COUNTRY_COORDS[part]) return COUNTRY_COORDS[part];

    // Check US places
    for (var j = 0; j < US_PLACES.length; j++) {
      if (part === US_PLACES[j] || part.indexOf(US_PLACES[j]) !== -1) {
        return COUNTRY_COORDS["united states"];
      }
    }

    // Check city mappings
    for (var city in CITY_COUNTRY) {
      if (part === city || part.indexOf(city) !== -1) {
        var countryKey = CITY_COUNTRY[city];
        if (COUNTRY_COORDS[countryKey]) return COUNTRY_COORDS[countryKey];
      }
    }
  }

  // Try the whole string against cities
  for (var city in CITY_COUNTRY) {
    if (text.indexOf(city) !== -1) {
      var countryKey = CITY_COUNTRY[city];
      if (COUNTRY_COORDS[countryKey]) return COUNTRY_COORDS[countryKey];
    }
  }

  return null;
}