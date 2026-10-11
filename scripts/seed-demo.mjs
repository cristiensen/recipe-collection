// Inserts 20 realistic demo recipes (with ratings and reviews) as test data.
// All data belongs to dedicated seed accounts, and photos live under one Blob
// prefix, so everything can be removed in one go without touching real data.
//
//   npm run seed:demo              add (or re-create) the demo recipes
//   npm run seed:demo -- --remove  remove them again
//
// Photos are generated placeholder images uploaded to Vercel Blob, so they
// display locally and on Vercel. Needs DATABASE_URL plus the Blob variables
// (`npm run check:blob` must pass).
import { randomUUID } from "node:crypto";
import { del, list, put } from "@vercel/blob";
import dotenv from "dotenv";
import pg from "pg";
import { gradientPng } from "./png.mjs";

dotenv.config({ path: [".env.local", ".env"], quiet: true });

const SEED_DOMAIN = "@example.test";
const SEED_PREFIX = "demo-seed-";
const BLOB_PREFIX = `recipes/images/${SEED_PREFIX}`;

// ─────────────────────────────── Demo data ───────────────────────────────

const CHEFS = ["Elena Demo", "Marco Demo"];
const REVIEWERS = ["Ana Demo", "Ben Demo", "Priya Demo", "Tom Demo"];

// [quantity, unit, name]: quantity and unit may be null
const RECIPES = [
  {
    title: "Classic Margherita Pizza",
    description:
      "A thin, blistered crust topped with bright tomato sauce, fresh mozzarella and basil. The dough needs an hour to rise, so start it before anything else.",
    minutes: 40,
    servings: 2,
    labels: ["VEGETARIAN"],
    colors: [
      [214, 69, 46],
      [245, 222, 179],
    ],
    ingredients: [
      [250, "g", "bread flour"],
      [160, "ml", "warm water"],
      [5, "g", "instant yeast"],
      [1, "tsp", "salt"],
      [200, "g", "canned crushed tomatoes"],
      [125, "g", "fresh mozzarella"],
      [null, null, "fresh basil leaves"],
      [1, "tbsp", "olive oil"],
    ],
    steps: [
      "Mix the flour, yeast and salt, add the warm water and knead for 8 minutes until smooth. Cover and leave to rise for 1 hour.",
      "Heat the oven to its highest setting with a baking tray or pizza stone inside.",
      "Season the crushed tomatoes with a pinch of salt and the olive oil.",
      "Stretch the dough into a thin round on a floured sheet of baking paper.",
      "Spread the sauce, tear over the mozzarella and slide onto the hot tray. Bake for 8–10 minutes until the crust is charred in spots.",
      "Scatter with basil and serve straight away.",
    ],
  },
  {
    title: "Chicken Tikka Masala",
    description:
      "Yogurt-marinated chicken, charred under the grill and simmered in a creamy, spiced tomato sauce. Serve with rice or naan.",
    minutes: 60,
    servings: 4,
    labels: ["SPICY", "GLUTEN_FREE"],
    colors: [
      [196, 92, 38],
      [240, 170, 90],
    ],
    ingredients: [
      [700, "g", "boneless chicken thighs"],
      [150, "g", "plain yogurt"],
      [2, "tbsp", "garam masala"],
      [1, "tsp", "chilli powder"],
      [1, null, "onion, finely chopped"],
      [3, "clove", "garlic"],
      [1, "tbsp", "grated ginger"],
      [400, "g", "canned chopped tomatoes"],
      [150, "ml", "double cream"],
      [2, "tbsp", "butter"],
    ],
    steps: [
      "Cut the chicken into bite-sized pieces and mix with the yogurt, half the garam masala, the chilli powder and a pinch of salt. Marinate for at least 20 minutes.",
      "Grill the chicken on a lined tray under a hot grill for 10 minutes, turning once, until charred at the edges.",
      "Melt the butter in a large pan and fry the onion for 8 minutes until golden. Add the garlic, ginger and remaining garam masala and cook for 1 minute.",
      "Add the tomatoes and simmer for 10 minutes, then blend until smooth if you like.",
      "Stir in the cream and the grilled chicken and simmer for 5 more minutes. Season to taste.",
    ],
  },
  {
    title: "Wild Mushroom Risotto",
    description:
      "Creamy arborio rice cooked slowly with a mix of mushrooms, white wine and parmesan. Keep the stock hot and stir often.",
    minutes: 40,
    servings: 4,
    labels: ["VEGETARIAN", "GLUTEN_FREE"],
    colors: [
      [120, 98, 76],
      [222, 206, 178],
    ],
    ingredients: [
      [300, "g", "arborio rice"],
      [400, "g", "mixed mushrooms, sliced"],
      [1.2, "l", "hot vegetable stock"],
      [125, "ml", "dry white wine"],
      [1, null, "shallot, finely chopped"],
      [2, "clove", "garlic"],
      [50, "g", "parmesan, grated"],
      [30, "g", "butter"],
      [2, "tbsp", "olive oil"],
    ],
    steps: [
      "Fry the mushrooms in half the oil over high heat until golden. Set aside.",
      "In the same pan, soften the shallot and garlic in the remaining oil for 3 minutes.",
      "Add the rice and stir for 1 minute until the edges turn translucent, then pour in the wine and let it bubble away.",
      "Add the stock a ladle at a time, stirring until each addition is absorbed, for about 18 minutes.",
      "Stir in the mushrooms, butter and parmesan. Cover and rest for 2 minutes before serving.",
    ],
  },
  {
    title: "Beef Tacos with Pico de Gallo",
    description:
      "Spiced minced beef in warm corn tortillas with a fresh tomato salsa. A fast weeknight dinner everyone can assemble themselves.",
    minutes: 30,
    servings: 4,
    labels: ["SPICY", "DAIRY_FREE", "QUICK"],
    colors: [
      [150, 72, 40],
      [250, 200, 80],
    ],
    ingredients: [
      [500, "g", "minced beef"],
      [1, "tbsp", "ground cumin"],
      [1, "tsp", "smoked paprika"],
      [1, "tsp", "chilli flakes"],
      [12, null, "small corn tortillas"],
      [3, null, "ripe tomatoes, diced"],
      [0.5, null, "red onion, finely diced"],
      [1, null, "jalapeño, finely chopped"],
      [1, null, "lime"],
      [null, null, "fresh coriander"],
    ],
    steps: [
      "Mix the tomatoes, red onion, jalapeño, a handful of chopped coriander, the juice of half the lime and a pinch of salt. Set the pico de gallo aside.",
      "Brown the beef in a hot pan, breaking it up, for 6–8 minutes.",
      "Add the cumin, paprika, chilli flakes and a splash of water and cook for 2 minutes more. Season with salt and the remaining lime juice.",
      "Warm the tortillas in a dry pan for 20 seconds per side.",
      "Fill the tortillas with beef and top with pico de gallo.",
    ],
  },
  {
    title: "Greek Salad",
    description:
      "Juicy tomatoes, cucumber, olives and a slab of feta with oregano and good olive oil. No lettuce, as it's made in Greece.",
    minutes: 15,
    servings: 2,
    labels: ["VEGETARIAN", "GLUTEN_FREE", "QUICK"],
    colors: [
      [60, 140, 70],
      [235, 235, 220],
    ],
    ingredients: [
      [4, null, "ripe tomatoes"],
      [1, null, "cucumber"],
      [1, null, "green pepper"],
      [0.5, null, "red onion"],
      [80, "g", "kalamata olives"],
      [200, "g", "feta"],
      [1, "tsp", "dried oregano"],
      [4, "tbsp", "extra virgin olive oil"],
    ],
    steps: [
      "Cut the tomatoes into wedges and the cucumber into thick half-moons.",
      "Slice the pepper and onion into thin rings.",
      "Combine the vegetables and olives in a shallow bowl and season with salt.",
      "Lay the feta on top, sprinkle with oregano and drizzle generously with olive oil.",
    ],
  },
  {
    title: "Spaghetti Carbonara",
    description:
      "The Roman classic: eggs, pecorino, guanciale and black pepper. No cream needed. The trick is to take the pan off the heat before adding the eggs.",
    minutes: 25,
    servings: 2,
    labels: ["QUICK"],
    colors: [
      [240, 210, 120],
      [250, 245, 225],
    ],
    ingredients: [
      [200, "g", "spaghetti"],
      [100, "g", "guanciale or pancetta"],
      [2, null, "eggs"],
      [1, null, "egg yolk"],
      [50, "g", "pecorino romano, finely grated"],
      [1, "tsp", "freshly ground black pepper"],
    ],
    steps: [
      "Cook the spaghetti in well-salted boiling water until al dente.",
      "Meanwhile, cut the guanciale into strips and fry gently until crisp and the fat has rendered.",
      "Whisk the eggs, yolk, pecorino and pepper together in a bowl.",
      "Drain the pasta, keeping a mug of the cooking water, and toss it in the pan with the guanciale. Take the pan off the heat.",
      "Pour in the egg mixture and toss quickly, adding splashes of pasta water until glossy and creamy. Serve with more pecorino.",
    ],
  },
  {
    title: "Thai Green Curry with Tofu",
    description:
      "Fragrant coconut curry with crispy tofu, green beans and Thai basil. Check the curry paste label, as some contain shrimp.",
    minutes: 35,
    servings: 4,
    labels: ["VEGAN", "GLUTEN_FREE", "DAIRY_FREE", "SPICY"],
    colors: [
      [90, 150, 60],
      [230, 240, 200],
    ],
    ingredients: [
      [400, "g", "firm tofu, cubed"],
      [3, "tbsp", "vegan green curry paste"],
      [400, "ml", "coconut milk"],
      [200, "ml", "vegetable stock"],
      [150, "g", "green beans, halved"],
      [1, null, "red pepper, sliced"],
      [1, "tbsp", "soy sauce (gluten-free)"],
      [1, "tsp", "brown sugar"],
      [null, null, "Thai basil leaves"],
      [2, "tbsp", "vegetable oil"],
    ],
    steps: [
      "Pat the tofu dry and fry it in the oil until golden on all sides. Set aside.",
      "Fry the curry paste in the same pan for 1 minute until fragrant.",
      "Stir in the coconut milk and stock and bring to a simmer.",
      "Add the green beans and pepper and cook for 5 minutes.",
      "Return the tofu, season with the soy sauce and sugar, and finish with Thai basil. Serve with jasmine rice.",
    ],
  },
  {
    title: "Blueberry Muffins",
    description:
      "Tall, fluffy muffins packed with blueberries and topped with a crunchy sugar crust. Best eaten warm on the day they're baked.",
    minutes: 35,
    servings: 12,
    labels: ["VEGETARIAN", "BREAKFAST"],
    colors: [
      [80, 70, 140],
      [235, 200, 150],
    ],
    ingredients: [
      [300, "g", "plain flour"],
      [150, "g", "caster sugar"],
      [2, "tsp", "baking powder"],
      [0.5, "tsp", "salt"],
      [2, null, "eggs"],
      [180, "ml", "milk"],
      [100, "ml", "vegetable oil"],
      [200, "g", "blueberries"],
      [2, "tbsp", "demerara sugar"],
    ],
    steps: [
      "Heat the oven to 200 °C and line a 12-hole muffin tin with paper cases.",
      "Whisk the flour, sugar, baking powder and salt in a large bowl.",
      "In a jug, whisk the eggs, milk and oil, then pour into the dry ingredients and stir until just combined. A few lumps are fine.",
      "Fold in the blueberries, spoon into the cases and sprinkle with demerara sugar.",
      "Bake for 20–22 minutes until risen and golden. Cool in the tin for 5 minutes.",
    ],
  },
  {
    title: "French Onion Soup",
    description:
      "Onions cooked low and slow until deeply caramelised, simmered in rich beef stock and finished with cheesy toasts under the grill.",
    minutes: 90,
    servings: 4,
    labels: [],
    colors: [
      [130, 80, 40],
      [230, 190, 120],
    ],
    ingredients: [
      [1, "kg", "onions, thinly sliced"],
      [50, "g", "butter"],
      [1, "tbsp", "plain flour"],
      [150, "ml", "dry white wine"],
      [1.2, "l", "beef stock"],
      [2, null, "thyme sprigs"],
      [8, null, "slices of baguette"],
      [120, "g", "gruyère, grated"],
    ],
    steps: [
      "Melt the butter in a large heavy pan and add the onions with a pinch of salt.",
      "Cook over low heat, stirring now and then, for about 50 minutes until soft and deep golden brown.",
      "Stir in the flour for 1 minute, then add the wine and let it reduce by half.",
      "Add the stock and thyme and simmer for 20 minutes. Season to taste.",
      "Ladle into ovenproof bowls, top with toasted baguette and gruyère and grill until bubbling.",
    ],
  },
  {
    title: "Chewy Chocolate Chip Cookies",
    description:
      "Crisp edges, chewy centres and pools of melted chocolate. Browning the butter first gives them a deep, toffee-like flavour.",
    minutes: 45,
    servings: 24,
    labels: ["VEGETARIAN", "DESSERT"],
    colors: [
      [110, 70, 40],
      [225, 180, 120],
    ],
    ingredients: [
      [170, "g", "butter"],
      [200, "g", "light brown sugar"],
      [50, "g", "caster sugar"],
      [1, null, "egg"],
      [1, null, "egg yolk"],
      [2, "tsp", "vanilla extract"],
      [280, "g", "plain flour"],
      [1, "tsp", "bicarbonate of soda"],
      [1, "tsp", "salt"],
      [250, "g", "dark chocolate, chopped"],
    ],
    steps: [
      "Melt the butter in a pan and cook until it smells nutty and turns golden brown. Cool for 10 minutes.",
      "Whisk the butter with both sugars, then beat in the egg, yolk and vanilla.",
      "Stir in the flour, bicarbonate of soda and salt, then fold in the chocolate.",
      "Chill the dough for 15 minutes. Heat the oven to 180 °C.",
      "Roll into balls, space well apart on lined trays and bake for 10–11 minutes until the edges are set but the centres look underdone.",
      "Leave on the tray for 5 minutes before moving to a rack.",
    ],
  },
  {
    title: "Red Lentil Soup",
    description:
      "A thick, warming soup of red lentils, carrots and cumin with a squeeze of lemon. Freezes well and costs very little to make.",
    minutes: 45,
    servings: 6,
    labels: ["VEGAN", "GLUTEN_FREE", "DAIRY_FREE"],
    colors: [
      [210, 110, 50],
      [250, 210, 150],
    ],
    ingredients: [
      [300, "g", "red lentils, rinsed"],
      [1, null, "onion, chopped"],
      [2, null, "carrots, diced"],
      [2, "clove", "garlic"],
      [2, "tsp", "ground cumin"],
      [1, "tsp", "smoked paprika"],
      [1.5, "l", "vegetable stock"],
      [400, "g", "canned chopped tomatoes"],
      [1, null, "lemon"],
      [2, "tbsp", "olive oil"],
    ],
    steps: [
      "Soften the onion and carrots in the oil for 8 minutes.",
      "Add the garlic, cumin and paprika and cook for 1 minute.",
      "Add the lentils, stock and tomatoes. Bring to the boil, then simmer for 25 minutes until the lentils have broken down.",
      "Blend until smooth, or leave chunky, and season with salt and lemon juice.",
    ],
  },
  {
    title: "Pan-Seared Salmon with Lemon-Dill Sauce",
    description:
      "Crispy-skinned salmon fillets with a quick buttery lemon and dill sauce. Ready in under half an hour.",
    minutes: 25,
    servings: 2,
    labels: ["GLUTEN_FREE", "QUICK"],
    colors: [
      [235, 130, 100],
      [240, 235, 210],
    ],
    ingredients: [
      [2, null, "salmon fillets, skin on"],
      [1, "tbsp", "vegetable oil"],
      [40, "g", "butter"],
      [1, null, "lemon"],
      [2, "tbsp", "fresh dill, chopped"],
      [1, "tsp", "capers"],
    ],
    steps: [
      "Pat the salmon dry and season the skin well with salt.",
      "Heat the oil in a frying pan over medium-high heat and lay in the salmon skin side down. Press gently for 10 seconds so it stays flat.",
      "Cook for 5–6 minutes until the skin is crisp, then flip and cook for 1–2 minutes more. Transfer to plates.",
      "Lower the heat, add the butter, the juice of the lemon, the dill and capers, and swirl until combined.",
      "Spoon the sauce over the salmon and serve.",
    ],
  },
  {
    title: "Avocado Toast with Poached Eggs",
    description:
      "Smashed avocado on sourdough, topped with soft poached eggs, chilli flakes and lemon. A weekend breakfast that's ready in 15 minutes.",
    minutes: 15,
    servings: 2,
    labels: ["VEGETARIAN", "BREAKFAST", "QUICK"],
    colors: [
      [120, 160, 70],
      [245, 225, 160],
    ],
    ingredients: [
      [2, null, "ripe avocados"],
      [2, null, "thick slices of sourdough"],
      [2, null, "very fresh eggs"],
      [0.5, null, "lemon"],
      [1, "pinch", "chilli flakes"],
      [1, "tbsp", "white wine vinegar"],
    ],
    steps: [
      "Bring a deep pan of water to a gentle simmer and add the vinegar.",
      "Mash the avocados with the lemon juice, salt and pepper.",
      "Toast the sourdough.",
      "Crack each egg into a cup, swirl the water and slide the eggs in. Poach for 3 minutes, then lift out with a slotted spoon.",
      "Spread the avocado on the toast, top with the eggs and finish with chilli flakes.",
    ],
  },
  {
    title: "Chili con Carne",
    description:
      "A rich, smoky chili with beef, kidney beans and a hint of dark chocolate. Even better the next day.",
    minutes: 120,
    servings: 6,
    labels: ["SPICY", "GLUTEN_FREE", "DAIRY_FREE"],
    colors: [
      [150, 45, 30],
      [220, 120, 60],
    ],
    ingredients: [
      [750, "g", "minced beef"],
      [2, null, "onions, chopped"],
      [3, "clove", "garlic"],
      [2, "tsp", "ground cumin"],
      [2, "tsp", "chilli powder"],
      [1, "tsp", "smoked paprika"],
      [800, "g", "canned chopped tomatoes"],
      [400, "g", "canned kidney beans, drained"],
      [300, "ml", "beef stock"],
      [20, "g", "dark chocolate"],
    ],
    steps: [
      "Brown the beef in batches in a large casserole and set aside.",
      "Fry the onions for 10 minutes until soft, then add the garlic and spices for 1 minute.",
      "Return the beef and add the tomatoes and stock. Simmer gently, partly covered, for 1 hour 15 minutes.",
      "Add the beans and chocolate and cook for 15 minutes more.",
      "Season and serve with rice, sour cream or tortilla chips.",
    ],
  },
  {
    title: "Crispy Falafel with Tahini Sauce",
    description:
      "Herby chickpea falafel fried until crunchy, served with a garlicky tahini sauce. Use dried chickpeas soaked overnight, not canned.",
    minutes: 50,
    servings: 4,
    labels: ["VEGAN", "DAIRY_FREE"],
    colors: [
      [140, 110, 50],
      [210, 220, 150],
    ],
    ingredients: [
      [250, "g", "dried chickpeas, soaked overnight"],
      [1, null, "small onion"],
      [3, "clove", "garlic"],
      [1, "cup", "parsley and coriander leaves"],
      [2, "tsp", "ground cumin"],
      [1, "tsp", "ground coriander"],
      [2, "tbsp", "plain flour"],
      [0.5, "tsp", "baking powder"],
      [80, "g", "tahini"],
      [null, null, "oil, for frying"],
    ],
    steps: [
      "Drain the chickpeas well and blitz with the onion, 2 garlic cloves, herbs and spices until finely chopped but not a paste.",
      "Stir in the flour, baking powder and 1 teaspoon of salt. Chill for 15 minutes.",
      "Whisk the tahini with the remaining garlic, a squeeze of lemon and enough cold water to make a pourable sauce.",
      "Shape the mixture into small patties and fry in 3 cm of hot oil for 3–4 minutes until deep golden.",
      "Drain on kitchen paper and serve in flatbreads with the tahini sauce and salad.",
    ],
  },
  {
    title: "Tiramisu",
    description:
      "Layers of coffee-soaked ladyfingers and light mascarpone cream, dusted with cocoa. Make it the day before so it can set overnight.",
    minutes: 30,
    servings: 8,
    labels: ["VEGETARIAN", "DESSERT"],
    colors: [
      [100, 70, 50],
      [240, 225, 200],
    ],
    ingredients: [
      [4, null, "eggs, separated"],
      [100, "g", "caster sugar"],
      [500, "g", "mascarpone"],
      [300, "ml", "strong coffee, cooled"],
      [3, "tbsp", "marsala or coffee liqueur"],
      [250, "g", "ladyfinger biscuits"],
      [2, "tbsp", "cocoa powder"],
    ],
    steps: [
      "Whisk the egg yolks and sugar until pale and thick, then beat in the mascarpone until smooth.",
      "Whisk the egg whites to stiff peaks and fold them gently into the mascarpone mixture.",
      "Mix the coffee and marsala in a shallow dish.",
      "Dip the ladyfingers briefly in the coffee and lay half of them in a dish. Cover with half the cream, then repeat.",
      "Chill for at least 6 hours, then dust with cocoa before serving.",
    ],
  },
  {
    title: "Homemade Chicken Noodle Soup",
    description:
      "A comforting soup made with a whole chicken, vegetables and egg noodles. The broth is the star, so let it simmer gently.",
    minutes: 90,
    servings: 6,
    labels: ["DAIRY_FREE"],
    colors: [
      [220, 180, 90],
      [245, 240, 215],
    ],
    ingredients: [
      [1.5, "kg", "whole chicken"],
      [2, null, "carrots, sliced"],
      [2, null, "celery sticks, sliced"],
      [1, null, "onion, halved"],
      [2, null, "bay leaves"],
      [150, "g", "egg noodles"],
      [null, null, "fresh parsley"],
    ],
    steps: [
      "Put the chicken, onion and bay leaves in a large pot, cover with 2.5 litres of cold water and bring slowly to a simmer. Skim off any foam.",
      "Simmer gently for 1 hour, then lift out the chicken and discard the onion and bay leaves.",
      "Add the carrots and celery to the broth and simmer for 10 minutes.",
      "Shred the chicken meat and return it to the pot with the noodles. Cook for 5 minutes until the noodles are tender.",
      "Season well and finish with chopped parsley.",
    ],
  },
  {
    title: "Vegetable Stir-Fry with Ginger and Garlic",
    description:
      "Crunchy vegetables tossed in a glossy ginger, garlic and soy sauce. Have everything chopped before you start, as it cooks in minutes.",
    minutes: 20,
    servings: 3,
    labels: ["VEGAN", "DAIRY_FREE", "QUICK"],
    colors: [
      [60, 130, 60],
      [240, 160, 60],
    ],
    ingredients: [
      [1, null, "head of broccoli, in small florets"],
      [1, null, "red pepper, sliced"],
      [150, "g", "snap peas"],
      [2, null, "carrots, cut into matchsticks"],
      [3, "clove", "garlic, sliced"],
      [1, "tbsp", "grated ginger"],
      [3, "tbsp", "soy sauce"],
      [1, "tbsp", "maple syrup"],
      [1, "tsp", "cornflour"],
      [2, "tbsp", "vegetable oil"],
    ],
    steps: [
      "Mix the soy sauce, maple syrup, cornflour and 3 tablespoons of water in a small bowl.",
      "Heat the oil in a wok over high heat until shimmering.",
      "Stir-fry the broccoli and carrots for 3 minutes, then add the pepper and snap peas for 2 minutes more.",
      "Add the garlic and ginger and toss for 30 seconds.",
      "Pour in the sauce and toss until glossy. Serve over rice or noodles.",
    ],
  },
  {
    title: "Apple Crumble",
    description:
      "Soft, cinnamon-spiced apples under a buttery oat crumble. Serve warm with custard or vanilla ice cream.",
    minutes: 55,
    servings: 6,
    labels: ["VEGETARIAN", "DESSERT"],
    colors: [
      [200, 150, 80],
      [240, 220, 170],
    ],
    ingredients: [
      [1, "kg", "cooking apples, peeled and chopped"],
      [50, "g", "light brown sugar"],
      [1, "tsp", "ground cinnamon"],
      [150, "g", "plain flour"],
      [100, "g", "cold butter, cubed"],
      [75, "g", "demerara sugar"],
      [50, "g", "rolled oats"],
    ],
    steps: [
      "Heat the oven to 190 °C.",
      "Toss the apples with the brown sugar and cinnamon and spread in a baking dish.",
      "Rub the butter into the flour until it looks like breadcrumbs, then stir in the demerara sugar and oats.",
      "Scatter the crumble evenly over the apples.",
      "Bake for 35–40 minutes until golden and bubbling at the edges.",
    ],
  },
  {
    title: "Huevos Rancheros",
    description:
      "Fried eggs on crisp corn tortillas with a smoky tomato salsa, black beans and avocado. A hearty Mexican breakfast.",
    minutes: 30,
    servings: 2,
    labels: ["VEGETARIAN", "GLUTEN_FREE", "BREAKFAST", "SPICY"],
    colors: [
      [210, 80, 40],
      [250, 220, 120],
    ],
    ingredients: [
      [4, null, "small corn tortillas"],
      [4, null, "eggs"],
      [400, "g", "canned chopped tomatoes"],
      [1, null, "chipotle in adobo, chopped"],
      [1, "clove", "garlic"],
      [200, "g", "canned black beans, drained"],
      [1, null, "avocado, sliced"],
      [null, null, "fresh coriander"],
      [2, "tbsp", "vegetable oil"],
    ],
    steps: [
      "Simmer the tomatoes, chipotle and garlic for 10 minutes until thickened. Season with salt.",
      "Warm the black beans in a small pan with a splash of water and mash lightly.",
      "Fry the tortillas in a little oil until crisp at the edges, and drain on kitchen paper.",
      "Fry the eggs in the remaining oil until the whites are set.",
      "Top each tortilla with beans, an egg and salsa, and finish with avocado and coriander.",
    ],
  },
];

const COMMENTS = [
  "Made this for a dinner party and everyone asked for the recipe!",
  "Really easy to follow. I'll be making this again.",
  "Good, but I needed a bit more salt than suggested.",
  "Turned out perfectly on the first try.",
  "My kids loved it, which never happens.",
  "Took me longer than the stated time, but worth it.",
  "I halved the recipe and it worked fine.",
  "Not my favourite, though the instructions were clear.",
  "Added extra garlic and it was fantastic.",
  "This is now a weekly staple in our house.",
];

// Deterministic pseudo-random numbers so every run produces the same data
let randomState = 7;
const rand = () => {
  randomState = (randomState * 1664525 + 1013904223) % 2 ** 32;
  return randomState / 2 ** 32;
};
const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const shift = (color, amount) =>
  color.map((c) => Math.max(0, Math.min(255, c + amount)));

// ─────────────────────────────── Blob photos ──────────────────────────────

async function removePhotos() {
  let removed = 0;
  let cursor;
  do {
    const page = await list({ prefix: BLOB_PREFIX, cursor });
    if (page.blobs.length > 0) {
      await del(page.blobs.map((b) => b.url));
      removed += page.blobs.length;
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return removed;
}

/** Uploads 1–3 photos per recipe and returns their URLs, in recipe order. */
async function uploadPhotos() {
  const urls = [];
  for (const recipe of RECIPES) {
    const [from, to] = recipe.colors;
    const photos = [];
    for (let p = 0; p < int(1, 3); p++) {
      const png = gradientPng(
        960,
        640,
        shift(from, p * 25),
        shift(to, -p * 25),
      );
      const blob = await put(
        `${BLOB_PREFIX}${slug(recipe.title)}-${p}.png`,
        png,
        { access: "public", contentType: "image/png", allowOverwrite: true },
      );
      photos.push(blob.url);
    }
    urls.push(photos);
  }
  return urls;
}

// ──────────────────────────────── Database ────────────────────────────────

async function removeUsers(db) {
  const { rowCount } = await db.query(
    `DELETE FROM "User" WHERE email LIKE $1`,
    [`${SEED_PREFIX}%${SEED_DOMAIN}`],
  );
  return rowCount;
}

async function createUser(db, name, level) {
  const id = randomUUID();
  const email = `${SEED_PREFIX}${slug(name)}${SEED_DOMAIN}`;
  // No password: these accounts can't log in.
  await db.query(
    `INSERT INTO "User" (id, name, email, "privilegeLevel", "updatedAt") VALUES ($1, $2, $3, $4, now())`,
    [id, name, email, level],
  );
  return id;
}

async function seed(db, photoUrls) {
  const chefIds = [];
  for (const name of CHEFS) chefIds.push(await createUser(db, name, 2));
  const reviewerIds = [];
  for (const name of REVIEWERS) reviewerIds.push(await createUser(db, name, 1));

  for (const [i, recipe] of RECIPES.entries()) {
    const id = randomUUID();
    // Newest first on the browse page: one recipe every day or two
    const createdAt = new Date(Date.now() - (i * 36 + int(1, 12)) * 36e5);
    await db.query(
      `INSERT INTO "Recipe" (id, title, description, "cookingMinutes", servings, labels, "authorId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6::"Label"[], $7, $8, $8)`,
      [
        id,
        recipe.title,
        recipe.description,
        recipe.minutes,
        recipe.servings,
        recipe.labels,
        chefIds[i % chefIds.length],
        createdAt,
      ],
    );
    for (const [p, url] of photoUrls[i].entries()) {
      await db.query(
        `INSERT INTO "RecipeImage" (id, "recipeId", url, position) VALUES ($1, $2, $3, $4)`,
        [randomUUID(), id, url, p],
      );
    }
    for (const [p, [quantity, unit, name]] of recipe.ingredients.entries()) {
      await db.query(
        `INSERT INTO "Ingredient" (id, "recipeId", position, name, quantity, unit) VALUES ($1, $2, $3, $4, $5, $6)`,
        [randomUUID(), id, p, name, quantity, unit],
      );
    }
    for (const [p, text] of recipe.steps.entries()) {
      await db.query(
        `INSERT INTO "Step" (id, "recipeId", position, text) VALUES ($1, $2, $3, $4)`,
        [randomUUID(), id, p, text],
      );
    }
    // A few recipes stay unrated ("No ratings yet"); the rest get 1–4 reviews
    if (i % 6 !== 5) {
      for (const reviewerId of reviewerIds.slice(
        0,
        int(1, reviewerIds.length),
      )) {
        await db.query(
          `INSERT INTO "Review" (id, "recipeId", "userId", rating, comment, "createdAt") VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            randomUUID(),
            id,
            reviewerId,
            int(3, 5),
            rand() < 0.7 ? COMMENTS[int(0, COMMENTS.length - 1)] : null,
            new Date(
              Math.min(Date.now(), createdAt.getTime() + int(2, 30) * 36e5),
            ),
          ],
        );
      }
    }
  }
  return {
    recipes: RECIPES.length,
    photos: photoUrls.reduce((n, p) => n + p.length, 0),
  };
}

// ──────────────────────────────────── Run ────────────────────────────────────

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (add it to .env)");
  process.exit(1);
}
if (!process.env.BLOB_STORE_ID) {
  console.error("BLOB_STORE_ID is not set; run `npm run check:blob` first.");
  process.exit(1);
}

const removedPhotos = await removePhotos();
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query("BEGIN");
  const removedUsers = await removeUsers(db);
  if (process.argv.includes("--remove")) {
    await db.query("COMMIT");
    console.log(
      `Removed ${removedUsers} demo accounts (and their recipes) and ${removedPhotos} photos.`,
    );
  } else {
    const photoUrls = await uploadPhotos();
    const added = await seed(db, photoUrls);
    await db.query("COMMIT");
    console.log(
      `Added ${added.recipes} demo recipes with ${added.photos} photos by ${CHEFS.join(" and ")}.` +
        " Run `npm run seed:demo -- --remove` to delete them.",
    );
  }
} catch (e) {
  await db.query("ROLLBACK");
  console.error("Seeding failed; nothing was changed in the database.", e);
  process.exitCode = 1;
} finally {
  await db.end();
}
