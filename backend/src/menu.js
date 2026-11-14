// =====================================================================
//  MENU & SHOP SETTINGS – the server's prices are the ones that count.
//  The website shows these prices too (it loads them from /api/menu),
//  so changing a price here changes it everywhere.
//  All prices are in CENTS (1050 = €10,50).
//  Prices taken from the official I Love Smash Burger menu board.
// =====================================================================

export const SHOP = {
  name: "I Love Smash Burger",
  pickupAddress: "World of Flavours, Johan Cruijff Boulevard 300, 1101 DS Amsterdam",
  // Opening hours per weekday (0 = Monday … 6 = Sunday). null = closed that day.
  hours: [
    { open: "12:00", close: "22:00" },
    { open: "12:00", close: "22:00" },
    { open: "12:00", close: "22:00" },
    { open: "12:00", close: "22:00" },
    { open: "12:00", close: "22:00" },
    { open: "12:00", close: "22:00" },
    { open: "12:00", close: "22:00" },
  ],
  closedDates: [],          // e.g. ["2026-12-25", "2027-01-01"]
  lastOrderMinutes: 15,     // stop taking orders this many minutes before closing
  prepMinutes: [15, 20],    // shown as "ready in ±15–20 min"
  slotMinutes: 15,          // pickup slots every 15 minutes
  payAtPickup: true,        // also allow "pay at pickup" (card/cash at the counter)
  maxItems: 30,             // max number of items in one order
};

// Sauces: chosen for free with a combo or an item with inclSauce, otherwise extra at this price.
export const SAUCES = [
  { id: "signature", price: 150, l: { nl: "Signature sauce", en: "Signature sauce" } },
  { id: "mayo",      price: 100, l: { nl: "Mayonaise",       en: "Mayonnaise" } },
  { id: "ketchup",   price: 100, l: { nl: "Ketchup",         en: "Ketchup" } },
  { id: "sriracha",  price: 150, l: { nl: "Sriracha mayo",   en: "Sriracha mayo" } },
  { id: "curry",     price: 100, l: { nl: "Curry",           en: "Curry" } },
  { id: "bbq",       price: 150, l: { nl: "BBQ-saus",        en: "BBQ sauce" } },
];

// combo:     surcharge to make it a combo (fries + a sauce of choice, sauce included).
// inclSauce: the price already includes one sauce of choice.
// Set available:false on an item to hide it (sold out).
export const ITEMS = [
  { id: "amsterdammetje", cat: "burgers", type: "burger", name: "Amsterdammetje", price: 1300, combo: 500, best: true,
    desc: { nl: "Double smash burger: twee gesmashte beef patties, beef bacon, gekarameliseerde ui, American cheddar, signature sauce, augurk en sla.",
            en: "Double smash burger: two smashed beef patties, beef bacon, caramelized onion, American cheddar, signature sauce, pickles and lettuce." } },
  { id: "diamant",        cat: "burgers", type: "burger", name: "Diamant uit de Bijlmer", price: 1600, combo: 500, best: true,
    desc: { nl: "Triple smash burger: drie gesmashte beef patties, beef bacon, gekarameliseerde ui, American cheddar, signature sauce, augurk en sla.",
            en: "Triple smash burger: three smashed beef patties, beef bacon, caramelized onion, American cheddar, signature sauce, pickles and lettuce." } },
  { id: "kipburger",      cat: "burgers", type: "chickenburger", name: "Crispy Chicken Burger", price: 1200, combo: 500,
    desc: { nl: "Crispy chicken, American cheddar, signature sauce, augurk en sla.",
            en: "Crispy chicken, American cheddar, signature sauce, pickles and lettuce." } },
  { id: "smoky",          cat: "dogs",    type: "dog",    name: "Smokey Hotdog", price: 1100, combo: 400,
    desc: { nl: "Kipworst op een zacht broodje met crispy uitjes en signature sauce.",
            en: "Chicken sausage on a soft bun with crispy onions and signature sauce." } },
  { id: "loaded_kip",     cat: "fries",   type: "fries",  name: "Grilled Chicken Loaded Fries", price: 1250,
    desc: { nl: "Friet met gegrilde kip, cheddarsaus, signature sauce en ketchup.",
            en: "Fries with grilled chicken, cheddar sauce, signature sauce and ketchup." } },
  { id: "loaded_beef",    cat: "fries",   type: "fries",  name: "Beef Loaded Fries", price: 1350,
    desc: { nl: "Friet met smash beef, cheddarsaus, signature sauce en ketchup.",
            en: "Fries with smash beef, cheddar sauce, signature sauce and ketchup." } },
  { id: "loaded_worst",   cat: "fries",   type: "fries",  name: "Hotdog Loaded Fries", price: 1250,
    desc: { nl: "Friet met plakjes hotdog, cheddarsaus, saus en crispy uitjes.",
            en: "Fries with sliced hot dog, cheddar sauce, sauce and crispy onions." } },
  { id: "tenders_fries",  cat: "fries",   type: "fries",  name: "3 Tenders met friet", price: 1300, inclSauce: true,
    desc: { nl: "Drie crispy tenders met friet en een saus naar keuze.",
            en: "Three crispy tenders with fries and a sauce of your choice." } },
  { id: "cheesy",         cat: "fries",   type: "fries",  name: "Cheesy Fries", price: 800,
    desc: { nl: "Friet met een flinke laag warme cheddarsaus.",
            en: "Fries with a generous layer of warm cheddar sauce." } },
  { id: "fries",          cat: "fries",   type: "fries",  name: "Friet met saus", price: 550, inclSauce: true,
    desc: { nl: "Gekruide friet met een saus naar keuze.",
            en: "Seasoned fries with a sauce of your choice." } },
  { id: "wings",          cat: "chicken", type: "snack",  name: "6 Chicken Wings", price: 950,
    desc: { nl: "Zes krokante kippenvleugels. Lekker met een dip erbij.",
            en: "Six crispy chicken wings. Great with a dip." } },
  { id: "tenders",        cat: "chicken", type: "snack",  name: "3 Crispy Tenders", price: 750,
    desc: { nl: "Drie krokante kipreepjes. Lekker met een dip erbij.",
            en: "Three crispy chicken strips. Great with a dip." } },
  // every sauce can also be ordered on its own (tab "Sauzen")
  ...SAUCES.map(x => ({ id: "saus_" + x.id, cat: "sauces", type: "sauce", name: x.l.nl, price: x.price,
    desc: { nl: "Los bakje saus.", en: "Separate pot of sauce." } })),
];

// "Zonder" tick boxes, like on the till.
export const WITHOUT = {
  burger: [
    { id: "cheese", l: { nl: "Geen kaas",   en: "No cheese" } },
    { id: "pickle", l: { nl: "Geen augurk", en: "No pickles" } },
    { id: "sauce",  l: { nl: "Geen saus",   en: "No sauce" } },
    { id: "onion",  l: { nl: "Geen uien",   en: "No onions" } },
    { id: "lettuce",l: { nl: "Geen sla",    en: "No lettuce" } },
  ],
  chickenburger: [
    { id: "cheese", l: { nl: "Geen kaas",   en: "No cheese" } },
    { id: "pickle", l: { nl: "Geen augurk", en: "No pickles" } },
    { id: "sauce",  l: { nl: "Geen saus",   en: "No sauce" } },
    { id: "lettuce",l: { nl: "Geen sla",    en: "No lettuce" } },
  ],
  dog: [
    { id: "onion",  l: { nl: "Geen crispy uitjes", en: "No crispy onions" } },
    { id: "sauce",  l: { nl: "Geen saus",          en: "No sauce" } },
  ],
};
