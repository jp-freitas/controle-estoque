import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { RootLayout } from './RootLayout'

test('renderiza o layout raiz com o título do sistema', () => {
  const router = createMemoryRouter([{ path: '/', element: <RootLayout /> }])
  render(<RouterProvider router={router} />)
  expect(screen.getByRole('heading', { name: 'Controle de Inventário' })).toBeInTheDocument()
})
