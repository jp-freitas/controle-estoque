import { Outlet } from 'react-router'

export function RootLayout() {
  return (
    <div className="bg-background text-foreground min-h-svh">
      <header className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Controle de Inventário</h1>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}
