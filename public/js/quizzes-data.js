/* ==========================================================================
   NutriBae Quiz Lab — the 9 quick quizzes (the 10th, Sweet Plan, has its own
   builder in plan.js). Each option adds points to one or more outcomes; the
   outcome with the most points wins. Wording stays on taste and routine,
   never health promises.
   ========================================================================== */
(function () {
  const H = {
    vanilla: "vanilla-birthday-cake-plant-based-protein-powder",
    chocolate: "chocolate-brownie-delight-plant-based-protein-powder",
    strawberry: "energy-powder-strawberry-shortcake",
    cotton: "energy-powder-cotton-candy",
    hydration: "hydration-powder-peach-mango",
    probiotic: "probiotic-20-billion",
    duo: "bundle-dessert-lovers-duo",
    sweetday: "bundle-sweet-day-set",
  };

  window.NB_QUIZZES = [
    {
      id: "flavor", emoji: "🎂", title: "Find your flavor match", desc: "Which NutriBae flavor was made for you?", color: "#FFD6E8",
      questions: [
        { q: "Pick a birthday dessert", opts: [["Funfetti cake", "🎂", { vanilla: 2 }], ["Fudgy brownie", "🍫", { chocolate: 2 }], ["Strawberry shortcake", "🍓", { strawberry: 2 }], ["Cotton candy at the fair", "🍭", { cotton: 2 }]] },
        { q: "Your coffee-shop order", opts: [["Vanilla latte", "🥛", { vanilla: 1 }], ["Mocha", "☕", { chocolate: 1 }], ["Pink drink", "🌸", { strawberry: 1, cotton: 1 }], ["Something blue and fun", "💙", { cotton: 2 }]] },
        { q: "Ice cream scoop?", opts: [["Vanilla bean", "🍦", { vanilla: 2 }], ["Double chocolate", "🍫", { chocolate: 2 }], ["Strawberry", "🍓", { strawberry: 2 }], ["Bubblegum", "🫧", { cotton: 2 }]] },
        { q: "What do you want it for most?", opts: [["Shakes & baking", "🧁", { vanilla: 1, chocolate: 1 }], ["A protein boost", "💪", { vanilla: 1, chocolate: 1 }], ["An energy lift", "⚡", { strawberry: 2, cotton: 2 }]] },
      ],
      outcomes: {
        vanilla: { title: "Vanilla Birthday Cake", text: "Sweet, cozy and goes with everything. You’re the friend who makes every day feel like a celebration.", products: [H.vanilla], recipes: ["birthday-cake-pancakes", "cinnamon-rolls", "vanilla-latte"], tip: "Vanilla is the most versatile for baking: pancakes, cookies and crepes." },
        chocolate: { title: "Chocolate Brownie Delight", text: "Rich, bold and a little indulgent. You know what you love, and it’s chocolate.", products: [H.chocolate], recipes: ["chocolate-mug-cake", "brownie-batter", "chocolate-brownie"], tip: "Try it in a 2-minute mug cake when the cravings hit." },
        strawberry: { title: "Strawberry Shortcake Energy", text: "Bright, fruity and full of good vibes. You want a lift that tastes like summer.", products: [H.strawberry], recipes: ["berry-vanilla-blast", "strawberry-almond-swirl"], tip: "One scoop with 6–10 oz of cold water, earlier in the day." },
        cotton: { title: "Cotton Candy Energy", text: "Playful and a little extra (in the best way). Your energy drink should be fun.", products: [H.cotton], recipes: ["pina-colada-vanilla-tropical"], tip: "Shake it with ice for a sweet, sugar-free lift." },
      },
    },
    {
      id: "energy", emoji: "⚡", title: "Energy match", desc: "Find the right lift for your day (or skip the caffeine).", color: "#FFE3C4",
      questions: [
        { q: "When does your energy dip?", opts: [["Right after I wake up", "🌅", { strawberry: 1, cotton: 1 }], ["The 3pm slump", "☀️", { strawberry: 2, cotton: 1 }], ["Before workouts", "🏃‍♀️", { cotton: 2, strawberry: 1 }], ["Evenings", "🌙", { calm: 3 }]] },
        { q: "How do you feel about caffeine?", opts: [["Love it", "☕", { strawberry: 1, cotton: 1 }], ["A little is fine", "🙂", { strawberry: 1 }], ["It keeps me up / makes me jittery", "😵‍💫", { calm: 4 }], ["I avoid it", "🚫", { calm: 6 }]] },
        { q: "Flavor mood?", opts: [["Fruity & creamy", "🍓", { strawberry: 2 }], ["Sweet & playful", "🍭", { cotton: 2 }], ["Juicy & tropical", "🥭", { calm: 2 }]] },
      ],
      outcomes: {
        strawberry: { title: "Strawberry Shortcake Energy", text: "A smooth, sugar-free lift with natural caffeine from green tea and L-theanine, for your slump hours.", products: [H.strawberry], recipes: [], tip: "Keep caffeine to earlier in the day so it doesn’t mess with your sleep." },
        cotton: { title: "Cotton Candy Energy", text: "Your pre-workout and busy-day buddy: sugar-free, sweet and fun.", products: [H.cotton], recipes: [], tip: "Drink it 20–30 minutes before you move." },
        calm: { title: "Caffeine-free Hydration", text: "You don’t need caffeine. Peach Mango Hydration gives you electrolytes and B vitamins with zero caffeine and zero sugar.", products: [H.hydration], recipes: [], tip: "One scoop in a big bottle of water, sip all afternoon." },
      },
    },
    {
      id: "hydration", emoji: "💧", title: "Hydration habits check", desc: "How sippy are you? Get your water goal and a plan.", color: "#CFEFFF",
      questions: [
        { q: "Glasses of water on a normal day?", opts: [["1–3", "🥛", { starter: 3 }], ["4–7", "🥤", { steady: 3 }], ["8 or more", "💦", { pro: 3 }]] },
        { q: "Plain water is…", opts: [["Boring, honestly", "😐", { starter: 2 }], ["Fine", "🙂", { steady: 1 }], ["My best friend", "😍", { pro: 1 }]] },
        { q: "How much do you sweat in a week?", opts: [["Barely", "🛋️", { starter: 1, steady: 1 }], ["A few workouts", "🏃‍♀️", { steady: 2 }], ["Daily training or a hot climate", "🔥", { pro: 3 }]] },
        { q: "Do you forget to drink?", opts: [["All the time", "🙈", { starter: 2 }], ["Sometimes", "🤷‍♀️", { steady: 2 }], ["Never", "✅", { pro: 2 }]] },
      ],
      outcomes: {
        starter: { title: "Sip Starter", text: "Let’s make water easy and tasty. Start with a goal of 6 glasses and let Peach Mango do the convincing.", products: [H.hydration], recipes: [], tip: "Turn on water reminders in My Sweet Day (11am and 3pm).", waterGoal: 6 },
        steady: { title: "Steady Sipper", text: "You’re doing well. A flavored bottle in the afternoon gets you to 8 without thinking.", products: [H.hydration], recipes: [], tip: "Track your glasses in My Sweet Day to keep your streak.", waterGoal: 8 },
        pro: { title: "Hydration Pro", text: "You move a lot and drink a lot. Electrolytes help you replace what you sweat out.", products: [H.hydration], recipes: [], tip: "Have a Hydration bottle during or after training.", waterGoal: 10 },
      },
    },
    {
      id: "workout", emoji: "🏋️‍♀️", title: "Workout fuel finder", desc: "What to sip before and after you move.", color: "#E3DCFF",
      questions: [
        { q: "Your favorite way to move", opts: [["Strength / weights", "🏋️‍♀️", { post: 3 }], ["Running / cardio", "🏃‍♀️", { endure: 3 }], ["Pilates / yoga", "🧘‍♀️", { post: 1, endure: 1 }], ["HIIT / classes", "🔥", { pre: 3 }]] },
        { q: "When do you train?", opts: [["Early morning", "🌅", { pre: 2 }], ["Lunch break", "☀️", { pre: 1, post: 1 }], ["After work", "🌆", { post: 1, endure: 1 }]] },
        { q: "How do you feel before a workout?", opts: [["Sleepy, need a push", "😴", { pre: 3 }], ["Ready to go", "💪", { post: 2 }], ["Thirsty", "💧", { endure: 2 }]] },
        { q: "Your main goal", opts: [["Build strength", "💪", { post: 3 }], ["Go longer", "⏱️", { endure: 3 }], ["Feel energized", "⚡", { pre: 3 }]] },
      ],
      outcomes: {
        pre: { title: "Pre-workout Spark", text: "Energy before, protein after: a sugar-free Energy drink 20–30 minutes before, then a shake to refuel.", products: [H.strawberry, H.vanilla], recipes: ["mocha-energy-boost"], tip: "Skip the Energy drink for evening workouts if caffeine keeps you up." },
        post: { title: "Strength Refuel", text: "A protein shake after training (20–21g plant protein) is your simplest win.", products: [H.chocolate], recipes: ["brownie-batter", "chocolate-banana-peanut-butter-cup"], tip: "Blend with a banana and ice for a thick, milkshake-style shake." },
        endure: { title: "Endurance Duo", text: "Hydration during, protein after, so you can keep going and recover deliciously.", products: [H.hydration, H.vanilla], recipes: ["berry-vanilla-blast"], tip: "Fill your bottle with Hydration before you head out." },
      },
    },
    {
      id: "breakfast", emoji: "🥞", title: "Breakfast boost", desc: "Your perfect high-protein breakfast in 3 taps.", color: "#FFF0C2",
      questions: [
        { q: "Time on a weekday morning?", opts: [["2 minutes, I’m running", "🏃‍♀️", { smoothie: 3 }], ["About 15 minutes", "⏱️", { pancakes: 2, waffles: 1 }], ["I prep the night before", "🗓️", { muffins: 3 }]] },
        { q: "Pick a texture", opts: [["Fluffy", "☁️", { pancakes: 3 }], ["Crispy", "🧇", { waffles: 3 }], ["Sippable", "🥤", { smoothie: 3 }], ["Soft & cakey", "🧁", { muffins: 3 }]] },
        { q: "Vanilla or chocolate mornings?", opts: [["Vanilla", "🎂", { pancakes: 1, smoothie: 1 }], ["Chocolate", "🍫", { muffins: 1, waffles: 1 }]] },
      ],
      outcomes: {
        pancakes: { title: "Birthday Cake Pancakes", text: "Fluffy, sprinkle-happy and 33g of protein per serving. Breakfast that feels like a party.", products: [H.vanilla], recipes: ["birthday-cake-pancakes", "brownie-pancakes"], tip: "Make a double batch and freeze extras." },
        waffles: { title: "Protein Waffles", text: "Crispy outside, soft inside, vanilla or chocolate. Weekend energy any day.", products: [H.vanilla, H.chocolate], recipes: ["vanilla-or-chocolate-waffles", "crepes-with-fruit-filling"], tip: "Top with berries and a drizzle of nut butter." },
        smoothie: { title: "2-minute Smoothie", text: "Blend, pour, go. A smoothie with 20g+ protein is the fastest breakfast win.", products: [H.vanilla], recipes: ["berry-vanilla-blast", "pina-colada-vanilla-tropical", "strawberry-almond-swirl"], tip: "Keep frozen fruit ready in the freezer." },
        muffins: { title: "Make-ahead Muffins", text: "Bake once, grab all week. Chocolate banana muffins with 34g of protein.", products: [H.chocolate], recipes: ["chocolate-banana-muffins"], tip: "They keep in the fridge for up to 5 days." },
      },
    },
    {
      id: "cravings", emoji: "🍫", title: "Craving decoder", desc: "What your craving says, and your sweet swap.", color: "#F5D7C8",
      questions: [
        { q: "When do cravings hit?", opts: [["After lunch", "🍽️", { coffee: 2, choc: 1 }], ["Late afternoon", "☀️", { crunchy: 2 }], ["After dinner", "🌙", { choc: 2, creamy: 1 }], ["When I’m stressed", "😮‍💨", { creamy: 2 }]] },
        { q: "What texture do you want?", opts: [["Gooey", "🍫", { choc: 3 }], ["Creamy", "🍦", { creamy: 3 }], ["Crunchy", "🥜", { crunchy: 3 }], ["Cold & sippable", "🧋", { coffee: 3 }]] },
        { q: "Pick one", opts: [["Brownie", "🟫", { choc: 2 }], ["Cheesecake", "🍰", { creamy: 2 }], ["Candy bar", "🍫", { crunchy: 2 }], ["Iced mocha", "☕", { coffee: 2 }]] },
      ],
      outcomes: {
        choc: { title: "Chocolate Craver", text: "Your swap: a 2-minute chocolate mug cake with 25g protein, warm, gooey and ready fast.", products: [H.chocolate], recipes: ["chocolate-mug-cake", "chocolate-brownie"], tip: "Try Sweet Swap for more chocolate ideas." },
        creamy: { title: "Creamy Comfort", text: "Your swap: strawberry cheesecake bites or a cookie dough bowl, creamy with way more protein.", products: [H.vanilla], recipes: ["strawberry-cheesecake-bites", "cookie-dough-bowl"], tip: "Make a batch of bites for the fridge." },
        crunchy: { title: "Crunch Lover", text: "Your swap: a chocolate peanut candy bar with 25g protein and that snap you want.", products: [H.chocolate, H.vanilla], recipes: ["chocolate-peanut-candy-bar", "chocolate-hazelnut-cups"], tip: "Keep them in the freezer for an extra-crunchy bite." },
        coffee: { title: "Café Sweetie", text: "Your swap: a mocha energy boost or vanilla latte shake, coffee-shop vibes with protein.", products: [H.chocolate], recipes: ["mocha-energy-boost", "vanilla-latte"], tip: "Use cold brew for the smoothest taste." },
      },
    },
    {
      id: "routine", emoji: "🌙", title: "Early bird or night owl?", desc: "Build a routine that fits your clock.", color: "#D9E4FF",
      questions: [
        { q: "Without an alarm, you’d wake up…", opts: [["Before 7am", "🌅", { bird: 3 }], ["Around 8–9am", "☀️", { mid: 3 }], ["After 10am", "🌙", { owl: 3 }]] },
        { q: "Your most productive time", opts: [["Morning", "📈", { bird: 2 }], ["Afternoon", "🕑", { mid: 2 }], ["Night", "🌌", { owl: 2 }]] },
        { q: "When do you crave sweets?", opts: [["With breakfast", "🥞", { bird: 1 }], ["Mid-afternoon", "🍪", { mid: 1 }], ["Late night", "🌙", { owl: 2 }]] },
      ],
      outcomes: {
        bird: { title: "Early Bird", text: "Morning: probiotic + protein breakfast. Late morning: Energy if you need it. You’re done with caffeine by noon.", products: [H.probiotic, H.vanilla, H.strawberry], recipes: ["birthday-cake-pancakes"], tip: "Set your daily reminder for 8am in My Sweet Day." },
        mid: { title: "Midday Mover", text: "Easy morning shake, Hydration in your bottle at lunch, Energy for the 3pm slump.", products: [H.vanilla, H.hydration, H.strawberry], recipes: ["berry-vanilla-blast"], tip: "Turn on 11am and 3pm water reminders." },
        owl: { title: "Night Owl", text: "Skip late caffeine. Hydration in the afternoon, a protein dessert at night instead of a sugar rush.", products: [H.hydration, H.chocolate], recipes: ["chocolate-mug-cake", "cookie-dough-bowl"], tip: "Set your daily reminder for the evening." },
      },
    },
    {
      id: "bundle", emoji: "🎁", title: "Which bundle are you?", desc: "Save more with the set that fits you.", color: "#FFD9F0",
      questions: [
        { q: "What would you use every day?", opts: [["Protein shakes & treats", "🥤", { duo: 3 }], ["A full sweet routine", "✨", { sweetday: 3 }], ["Just one flavor", "🎂", { single: 3 }]] },
        { q: "Vanilla, chocolate or both?", opts: [["Both, obviously", "🍫", { duo: 3 }], ["Vanilla", "🎂", { sweetday: 1, single: 1 }], ["Chocolate", "🍫", { single: 2 }]] },
        { q: "Energy and hydration too?", opts: [["Yes please", "⚡", { sweetday: 3 }], ["Maybe later", "🙂", { duo: 1, single: 1 }], ["Not for me", "🙅‍♀️", { duo: 2 }]] },
      ],
      outcomes: {
        duo: { title: "Dessert Lovers Duo", text: "Vanilla Birthday Cake + Chocolate Brownie Delight together at 10% off. Never choose again.", products: [H.duo], recipes: ["vanilla-or-chocolate-waffles", "chocolate-chip-cookies"], tip: "Add Subscribe & save for even more off." },
        sweetday: { title: "Sweet Day Set", text: "Protein, Energy and Hydration: your whole sweet day in one set, 15% off.", products: [H.sweetday], recipes: ["berry-vanilla-blast"], tip: "Track all three in My Sweet Day." },
        single: { title: "Start with one", text: "Start with your favorite protein and Subscribe & save 15%. You can add more anytime.", products: [H.vanilla], recipes: ["birthday-cake-pancakes"], tip: "Not sure which flavor? Take “Find your flavor match”." },
      },
    },
    {
      id: "tummy", emoji: "🌿", title: "Happy tummy habits", desc: "Small daily habits for a routine that feels good.", color: "#D8F5E3",
      questions: [
        { q: "How regular is your daily routine?", opts: [["Pretty consistent", "📅", { balanced: 2 }], ["All over the place", "🌀", { builder: 3 }]] },
        { q: "Fruits and veggies most days?", opts: [["Yes", "🥦", { balanced: 2 }], ["Some days", "🍎", { builder: 1, balanced: 1 }], ["Not really", "🍟", { builder: 2 }]] },
        { q: "Water on a normal day?", opts: [["8+ glasses", "💦", { balanced: 2 }], ["Less than that", "🥛", { builder: 2 }]] },
        { q: "Would a once-a-day capsule fit your routine?", opts: [["Yes, easy", "💊", { balanced: 2, builder: 1 }], ["I’d need a reminder", "🔔", { builder: 2 }]] },
      ],
      outcomes: {
        balanced: { title: "Balanced Bae", text: "Your habits are on track. A daily probiotic is an easy add with your morning glass of water.", products: [H.probiotic], recipes: [], tip: "Take it at the same time every day so it sticks." },
        builder: { title: "Habit Builder", text: "Start small: one probiotic capsule each morning and a Hydration bottle to drink more water.", products: [H.probiotic, H.hydration], recipes: [], tip: "Turn on the daily reminder in My Sweet Day." },
      },
    },
  ];
})();
