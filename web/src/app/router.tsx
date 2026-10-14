import { createBrowserRouter } from 'react-router'
import { RootLayout } from './RootLayout'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [{ index: true, element: <p>Em construção.</p> }],
  },
])
