import { createBrowserRouter, type RouteObject } from 'react-router'
import {
  AcessoDesativadoPage,
  AguardandoLiberacaoPage,
  EntrarPage,
  PrimeiroAcessoPage,
  RecuperarSenhaPage,
  RedefinirSenhaPage,
  RequerAdmin,
  RequerAtivo,
  RequerSessao,
} from '@/features/auth'
import { RootLayout } from './RootLayout'

// spec-001/RF-08: rotas por sessão, status e perfil (a proteção real é a RLS).
export const rotas: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { path: 'entrar', element: <EntrarPage /> },
      { path: 'recuperar-senha', element: <RecuperarSenhaPage /> },
      { path: 'redefinir-senha', element: <RedefinirSenhaPage /> },
      { path: 'primeiro-acesso', element: <PrimeiroAcessoPage /> },
      {
        element: <RequerSessao />,
        children: [
          { path: 'aguardando', element: <AguardandoLiberacaoPage /> },
          { path: 'desativado', element: <AcessoDesativadoPage /> },
          {
            element: <RequerAtivo />,
            children: [
              { index: true, element: <p>Em construção.</p> },
              // Substituídas pelas telas das tarefas T-25 a T-27.
              { path: 'meu-perfil', element: <p>Meu perfil (T-27).</p> },
              {
                path: 'admin',
                element: <RequerAdmin />,
                children: [
                  { path: 'usuarios', element: <p>Usuários (T-26).</p> },
                  { path: 'convites', element: <p>Convites (T-25).</p> },
                ],
              },
              { path: '*', element: <p>Página não encontrada.</p> },
            ],
          },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter(rotas)
