export const lists = [
  {
    title: "Best Selling",
    items: [
      {
        title: "Acetate Sunglasses",
        price: 10.99,
        rating: 5.0,
        ratingCount: 70,
        image: "/image.png",
      },
      {
        title: "Wool Cashmere Jacket",
        price: 180,
        rating: 4.7,
        ratingCount: 23,
        image: "/coat.png",
      },
      {
        title: "Travel Pet Carrier",
        price: 42,
        rating: 4.5,
        ratingCount: 50,
        image: "/bag.png",
      },
      {
        title: "Clem Cashmere Scarf",
        price: 65,
        rating: 4.9,
        ratingCount: 46,
        image: "/scarf.png",
      },
    ],
  },
  {
    title: "New Arrivals",
    items: [
      {
        title: "Wool Cashmere Jacket",
        price: 180,
        rating: 4.7,
        ratingCount: 23,
        image: "/coat.png",
      },
      {
        title: "Acetate Sunglasses",
        price: 10.99,
        rating: 5.0,
        ratingCount: 70,
        image: "/image.png",
      },
      {
        title: "Clem Cashmere Scarf",
        price: 65,
        rating: 4.9,
        ratingCount: 46,
        image: "/scarf.png",
      },
      {
        title: "Travel Pet Carrier",
        price: 42,
        rating: 4.5,
        ratingCount: 50,
        image: "/bag.png",
      },
    ],
  },
];

export const product = {
  name: "VIP Access",
  href: "/",
  price: 100.0,
  rating: 5,
  breadcrumbs: [
    { id: 1, name: "Bundles", href: "/" },
    { id: 2, name: "Basic", href: "/" },
  ],
  images: [
    {
      id: 1,
      image:
        "https://res.cloudinary.com/dpytkhyme/image/upload/v1686557282/STREETBEEFS%20SCRAPYARD/firechicken_animated_photo_fj1xej.jpg",
      alt: "",
    },
    // More images...
  ],
  colors: [
    { name: "Washed Black", value: "#6C6C6C" },
    { name: "Washed gray", value: "#F7F0EA" },
    { name: "White", value: "#FFFFFF" },
  ],
  sizes: [
    { name: "XL", selectedSize: "xl" },
    { name: "L", selectedSize: "l" },
    { name: "M", selectedSize: "m" },
    { name: "S", selectedSize: "s" },
    { name: "XS", selectedSize: "xs" },
  ],
  description: `
        <p>The Scrapyard video game is a fighting game featuring all of your favorite STREETBEEFS SCRAPYARD YouTube channel fighters</p>
      `,
  details: [
    {
      name: "Features",
      items: [
        "Multiple button configurations",
        "Assist mode",
        "Online multiplayer",
        "Local multiplayer",
        "Story mode",
        "Arcade mode",
        "Training mode",
      ],
    },
    // More sections...
  ],
};

export const reviews = {
  average: 4,
  totalCount: 1624,
  counts: [
    { rating: 5, count: 1019 },
    { rating: 4, count: 162 },
    { rating: 3, count: 97 },
    { rating: 2, count: 199 },
    { rating: 1, count: 147 },
  ],
  featured: [
    {
      id: 1,
      rating: 5,
      content: `
            <p>This is the bag of my dreams. I took it on my last vacation and was able to fit an absurd amount of snacks for the many long and hungry flights.</p>
          `,

      avatarSrc:
        "https://images.unsplash.com/photo-1502685104226-ee32379fefbe?ixlib=rb-=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=8&w=256&h=256&q=80",
    },
    {
      id: 1,
      rating: 5,
      content: `
            <p>This is the bag of my dreams. I took it on my last vacation and was able to fit an absurd amount of snacks for the many long and hungry flights.</p>
          `,

      avatarSrc:
        "https://images.unsplash.com/photo-1502685104226-ee32379fefbe?ixlib=rb-=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=8&w=256&h=256&q=80",
    },
    // More reviews...
  ],
};

export const filters = [
  {
    id: "color",
    name: "Color",
    options: [
      { value: "white", label: "White" },
      { value: "beige", label: "Beige" },
      { value: "blue", label: "Blue" },
      { value: "brown", label: "Brown" },
      { value: "green", label: "Green" },
      { value: "purple", label: "Purple" },
    ],
  },
  {
    id: "sizes",
    name: "Sizes",
    options: [
      { value: "xs", label: "XS" },
      { value: "s", label: "S" },
      { value: "m", label: "M" },
      { value: "l", label: "L" },
      { value: "xl", label: "XL" },
      { value: "2xl", label: "2XL" },
    ],
  },
];

export const shopItems = [
  {
    id: "1",
    title: "Fire Chicken",
    url: "https://www.youtube.com/watch?v=3-8wxIugeFg&t=18s",
    content: "Great Fight 1 ",
  },
  {
    id: "2",
    title: "Viking Warrior",
    url: "https://www.youtube.com/watch?v=aDHFVYthOM4",
    content: "Great Fight 2",
  },
  {
    id: "3",
    title: "The Beast",
    url: "https://www.youtube.com/watch?v=vxceVYeE0tk",
    content: "Great Fight 3",
  },
  {
    id: "4",
    title: "The Beast",
    url: "https://www.youtube.com/watch?v=pf6LNjTtEmQ&t=462s",
    content: "Great Fight 4",
  },
  {
    id: "5",
    title: "The Beast",
    url: "https://www.youtube.com/watch?v=itaQQoPXFRU&t=150s",
    content: "Great Fight 5",
  },
];

export const store = {
  categories: [
    {
      id: "women",
      name: "Women",
      featured: [
        {
          name: "New Arrivals",
          href: "#",
          image:
            "https://tailwindui.com/img/ecommerce-images/mega-menu-category-01.jpg",
          alt: "Models sitting back to back, wearing Basic Tee in black and bone.",
        },
        {
          name: "Basic Tees",
          href: "#",
          image:
            "https://tailwindui.com/img/ecommerce-images/mega-menu-category-02.jpg",
          alt: "Close up of Basic Tee fall bundle with off-white, ochre, olive, and black tees.",
        },
      ],
      sections: [
        {
          id: "clothing",
          name: "Clothing",
          items: [
            { name: "Tops", href: "#" },
            { name: "Dresses", href: "#" },
            { name: "Pants", href: "#" },
            { name: "Denim", href: "#" },
            { name: "Sweaters", href: "#" },
            { name: "T-Shirts", href: "#" },
            { name: "Jackets", href: "#" },
            { name: "Activewear", href: "#" },
            { name: "Browse All", href: "#" },
          ],
        },
        {
          id: "accessories",
          name: "Accessories",
          items: [
            { name: "Watches", href: "#" },
            { name: "Wallets", href: "#" },
            { name: "Bags", href: "#" },
            { name: "Sunglasses", href: "#" },
            { name: "Hats", href: "#" },
            { name: "Belts", href: "#" },
          ],
        },
        {
          id: "brands",
          name: "Brands",
          items: [
            { name: "Full Nelson", href: "#" },
            { name: "My Way", href: "#" },
            { name: "Re-Arranged", href: "#" },
            { name: "Counterfeit", href: "#" },
            { name: "Significant Other", href: "#" },
          ],
        },
      ],
    },
    {
      id: "men",
      name: "Men",
      featured: [
        {
          name: "New Arrivals",
          href: "#",
          image:
            "https://tailwindui.com/img/ecommerce-images/product-page-04-detail-product-shot-01.jpg",
          alt: "Drawstring top with elastic loop closure and textured interior padding.",
        },
        {
          name: "Artwork Tees",
          href: "#",
          image:
            "https://tailwindui.com/img/ecommerce-images/category-page-02-image-card-06.jpg",
          alt: "Three shirts in gray, white, and blue arranged on table with same line drawing of hands and shapes overlapping on front of shirt.",
        },
      ],
      sections: [
        {
          id: "clothing",
          name: "Clothing",
          items: [
            { name: "Tops", href: "#" },
            { name: "Pants", href: "#" },
            { name: "Sweaters", href: "#" },
            { name: "T-Shirts", href: "#" },
            { name: "Jackets", href: "#" },
            { name: "Activewear", href: "#" },
            { name: "Browse All", href: "#" },
          ],
        },
        {
          id: "accessories",
          name: "Accessories",
          items: [
            { name: "Watches", href: "#" },
            { name: "Wallets", href: "#" },
            { name: "Bags", href: "#" },
            { name: "Sunglasses", href: "#" },
            { name: "Hats", href: "#" },
            { name: "Belts", href: "#" },
          ],
        },
        {
          id: "brands",
          name: "Brands",
          items: [
            { name: "Re-Arranged", href: "#" },
            { name: "Counterfeit", href: "#" },
            { name: "Full Nelson", href: "#" },
            { name: "My Way", href: "#" },
          ],
        },
      ],
    },
  ],
  pages: [
    { name: "Company", href: "#" },
    { name: "Stores", href: "#" },
  ],
};

export const favorites = [
  {
    id: 1,
    name: "Black Basic Tee",
    price: "$32",
    href: "#",
    image:
      "https://tailwindui.com/img/ecommerce-images/home-page-03-favorite-01.jpg",
    alt: "Model wearing women's black cotton crewneck tee.",
  },
  {
    id: 2,
    name: "Off-White Basic Tee",
    price: "$32",
    href: "#",
    image:
      "https://tailwindui.com/img/ecommerce-images/home-page-03-favorite-02.jpg",
    alt: "Model wearing women's off-white cotton crewneck tee.",
  },
  {
    id: 3,
    name: "Mountains Artwork Tee",
    price: "$36",
    href: "#",
    image:
      "https://tailwindui.com/img/ecommerce-images/home-page-03-favorite-03.jpg",
    alt: "Model wearing women's burgundy red crewneck artwork tee with small white triangle overlapping larger black triangle.",
  },
];
