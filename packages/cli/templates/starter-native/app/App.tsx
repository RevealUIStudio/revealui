import { Heading, LinkBehaviorProvider, LinkButton, Text } from '@revealui/presentation';
import { Link, Router, RouterProvider, Routes } from '@revealui/router';
import { RootLayout } from './layouts/RootLayout.js';
import { HomePage } from './routes/HomePage.js';

const router = new Router();

function NotFoundPage(): React.ReactNode {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Heading>Page not found</Heading>
      <Text className="mt-3">
        The page you are looking for does not exist.{' '}
        <LinkButton href="/" appearance="link" size="sm">
          Return home
        </LinkButton>
      </Text>
    </main>
  );
}

router.registerRoutes([
  {
    path: '/',
    component: HomePage,
    layout: RootLayout,
  },
  {
    path: '/*notfound',
    component: NotFoundPage,
    layout: RootLayout,
  },
]);

export function App(): React.ReactNode {
  return (
    <RouterProvider router={router}>
      <LinkBehaviorProvider component={Link} hrefProp="to">
        <Routes />
      </LinkBehaviorProvider>
    </RouterProvider>
  );
}
