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
import { CatalogoPage } from '@/features/catalogo'
import { ItensPage, LocaisPage, TiposPage } from '@/features/itens-admin'
import { ConvitesPage, MeuPerfilPage, UsuariosPage } from '@/features/usuarios'
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
              { index: true, element: <CatalogoPage /> },
              { path: 'meu-perfil', element: <MeuPerfilPage /> },
              {
                path: 'admin',
                element: <RequerAdmin />,
                children: [
                  { path: 'itens', element: <ItensPage /> },
                  { path: 'tipos', element: <TiposPage /> },
                  { path: 'locais', element: <LocaisPage /> },
                  { path: 'usuarios', element: <UsuariosPage /> },
                  { path: 'convites', element: <ConvitesPage /> },
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
