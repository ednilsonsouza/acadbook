import { Client, Databases, Storage, Functions, Users } from 'node-appwrite'

/**
 * Client do Appwrite com API Key para uso exclusivo no servidor.
 * NUNCA importar este arquivo em componentes client ou código do browser.
 */
export function createAdminClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!)

  return {
    databases: new Databases(client),
    storage: new Storage(client),
    functions: new Functions(client),
    users: new Users(client),
    client,
  }
}

/**
 * Client do Appwrite com sessão do usuário (JWT) para operações
 * que precisam respeitar as permissões de documento.
 */
export function createSessionClient(jwt: string) {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setJWT(jwt)

  return {
    databases: new Databases(client),
    storage: new Storage(client),
    functions: new Functions(client),
    client,
  }
}
