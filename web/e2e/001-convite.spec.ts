// spec-001/T-28: convite de ponta a ponta (RF-10, RF-11, RF-05; CA-08, CA-09, CA-03, CA-02).
// Requer a stack local (`supabase start`) com o seed: admin@escola.test / Senha!123.
import { expect, test, type Page } from '@playwright/test'
import { esperarEmail } from './helpers/mailpit.ts'

const ADMIN = { email: 'admin@escola.test', senha: 'Senha!123' }

async function entrar(page: Page, email: string, senha: string) {
  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

test('T-28: admin convida → convidado define senha → aguarda → admin aprova → convidado entra', async ({
  browser,
}) => {
  const email = `e2e-${Date.now()}@teste.test`
  const senha = 'Convidado!1'
  const admin = await (await browser.newContext()).newPage()
  const convidado = await (await browser.newContext()).newPage()

  await test.step('CA-08: admin cria o convite', async () => {
    await entrar(admin, ADMIN.email, ADMIN.senha)
    await admin.getByRole('link', { name: 'Convites' }).click()
    await admin.getByLabel('E-mail').fill(email)
    await admin.getByLabel('Nome').fill('Prof. E2E')
    await admin.getByRole('button', { name: 'Enviar convite' }).click()
    await expect(admin.getByText(`Convite enviado para ${email}`)).toBeVisible()
    await expect(admin.getByRole('row', { name: new RegExp(email) })).toContainText('Enviado')
  })

  await test.step('RF-11: e-mail em pt-BR chega no Mailpit e leva ao primeiro acesso', async () => {
    const { assunto, link } = await esperarEmail(email)
    expect(assunto).toBe('Convite para o Controle de Inventário')
    await convidado.goto(link)
    await expect(convidado).toHaveURL(/\/primeiro-acesso/)
    await expect(convidado.getByRole('heading', { name: /Crie sua senha/ })).toBeVisible()
  })

  await test.step('CA-09 / CA-02: convidado define a senha e fica aguardando liberação', async () => {
    await convidado.getByLabel('Nova senha').fill(senha)
    await convidado.getByLabel('Confirme a senha').fill(senha)
    await convidado.getByRole('button', { name: 'Criar senha e aceitar convite' }).click()
    await expect(convidado.getByRole('heading', { name: 'Aguardando liberação' })).toBeVisible()
    await expect(convidado.getByRole('navigation', { name: 'Principal' })).toHaveCount(0)
  })

  await test.step('CA-03: admin aprova o usuário pendente', async () => {
    await admin.getByRole('link', { name: 'Usuários' }).click()
    const linha = admin.getByRole('row', { name: new RegExp(email) })
    await expect(linha).toContainText('Pendente')
    await linha.getByRole('button', { name: 'Aprovar' }).click()
    await admin.getByRole('dialog').getByRole('button', { name: 'Aprovar' }).click()
    await expect(linha).toContainText('Ativo')
  })

  await test.step('convidado aprovado entra com a senha definida', async () => {
    await convidado.getByRole('button', { name: 'Sair' }).first().click()
    await expect(convidado).toHaveURL(/\/entrar/)
    await entrar(convidado, email, senha)
    await expect(convidado.getByRole('navigation', { name: 'Principal' })).toBeVisible()
    await expect(convidado.getByRole('link', { name: 'Usuários' })).toHaveCount(0)
  })
})

test('CA-01: sem convite não há como criar conta pela interface', async ({ page }) => {
  await page.goto('/entrar')
  await expect(page.getByRole('link', { name: /cadastr|criar conta/i })).toHaveCount(0)
})
