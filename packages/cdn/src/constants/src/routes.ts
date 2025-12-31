interface Route {
  name: string;
  href: string;
  current: boolean;
}

export const routes: Route[] = [
  {
    name: "Home",
    href: "/",
    current: false,
  },
  {
    name: "About",
    href: "/about",
    current: false,
  },
  {
    name: "Fighters",
    href: "/fighters",
    current: false,
  },
  {
    name: "Events",
    href: "/events",
    current: false,
  },
  {
    name: "Shop",
    href: "/shop",
    current: false,
  },
  {
    name: "Game",
    href: "/game",
    current: false,
  },
  {
    name: "Music",
    href: "/music",
    current: false,
  },
  {
    name: "Support",
    href: "/support",
    current: false,
  },
];
