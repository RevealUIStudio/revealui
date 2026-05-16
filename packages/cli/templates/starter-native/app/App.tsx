import { Router, RouterProvider, Routes } from '@revealui/router';
import { RootLayout } from './layouts/RootLayout.js';
import { HomePage } from './routes/HomePage.js';

const router = new Router();

router.registerRoutes([
  {
    path: '/',
    component: HomePage,
    layout: RootLayout,
  },
  {
    path: '/*notfound',
    component: () => (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Page not found</h1>
        <p className="mt-3 text-gray-600">
          The page you are looking for does not exist.{' '}
          <a href="/" className="font-medium text-emerald-600 hover:text-emerald-700">
            Return home
          </a>
        </p>
      </main>
    ),
    layout: RootLayout,
  },
]);

export function App(): React.ReactNode {
  return (
    <RouterProvider router={router}>
      <Routes />
    </RouterProvider>
  );
}
