
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "auditoria": {
                  Row: {
                    "acao": string,"campos_alterados": (string)[] | null,"criado_em": string,"dados_antes": Json | null,"dados_depois": Json | null,"id": number,"motivo": string | null,"registro_id": string,"tabela": string,"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "acao": string,"campos_alterados"?: (string)[] | null,"criado_em"?: string,"dados_antes"?: Json | null,"dados_depois"?: Json | null,"id"?: never,"motivo"?: string | null,"registro_id": string,"tabela": string,"usuario_id"?: string | null
                  }
                  Update: {
                    "acao"?: string,"campos_alterados"?: (string)[] | null,"criado_em"?: string,"dados_antes"?: Json | null,"dados_depois"?: Json | null,"id"?: never,"motivo"?: string | null,"registro_id"?: string,"tabela"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"convite": {
                  Row: {
                    "aceito_em": string | null,"cancelado_em": string | null,"convidado_por": string,"criado_em": string,"email": string,"expira_em": string,"id": string,"matricula": string | null,"nome": string,"perfil": Database["public"]['Enums']["perfil"],"convite_em_aberto": boolean | null
                  }
                  ComputedFields: "convite_em_aberto"
                  Insert: {
                    "aceito_em"?: string | null,"cancelado_em"?: string | null,"convidado_por": string,"criado_em"?: string,"email": string,"expira_em"?: string,"id"?: string,"matricula"?: string | null,"nome": string,"perfil"?: Database["public"]['Enums']["perfil"]
                  }
                  Update: {
                    "aceito_em"?: string | null,"cancelado_em"?: string | null,"convidado_por"?: string,"criado_em"?: string,"email"?: string,"expira_em"?: string,"id"?: string,"matricula"?: string | null,"nome"?: string,"perfil"?: Database["public"]['Enums']["perfil"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "convite_convidado_por_fkey"
      columns: ["convidado_por"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "atualizado_em": string,"criado_em": string,"email": string,"id": string,"matricula": string | null,"nome": string,"perfil": Database["public"]['Enums']["perfil"],"status": Database["public"]['Enums']["status_usuario"]
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"criado_em"?: string,"email": string,"id": string,"matricula"?: string | null,"nome": string,"perfil"?: Database["public"]['Enums']["perfil"],"status"?: Database["public"]['Enums']["status_usuario"]
                  }
                  Update: {
                    "atualizado_em"?: string,"criado_em"?: string,"email"?: string,"id"?: string,"matricula"?: string | null,"nome"?: string,"perfil"?: Database["public"]['Enums']["perfil"],"status"?: Database["public"]['Enums']["status_usuario"]
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "convite_situacao": {
                  Row: {
                    "aceito_em": string | null,"cancelado_em": string | null,"convidado_por": string | null,"criado_em": string | null,"email": string | null,"expira_em": string | null,"id": string | null,"matricula": string | null,"nome": string | null,"perfil": Database["public"]['Enums']["perfil"] | null,"situacao": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "aceito_em"?: string | null,"cancelado_em"?: string | null,"convidado_por"?: string | null,"criado_em"?: string | null,"email"?: string | null,"expira_em"?: string | null,"id"?: string | null,"matricula"?: string | null,"nome"?: string | null,"perfil"?: Database["public"]['Enums']["perfil"] | null,"situacao"?: never
                         }
                        Update: {
                           "aceito_em"?: string | null,"cancelado_em"?: string | null,"convidado_por"?: string | null,"criado_em"?: string | null,"email"?: string | null,"expira_em"?: string | null,"id"?: string | null,"matricula"?: string | null,"nome"?: string | null,"perfil"?: Database["public"]['Enums']["perfil"] | null,"situacao"?: never
                         }
                        Relationships: [
                    {
      foreignKeyName: "convite_convidado_por_fkey"
      columns: ["convidado_por"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "aceitar_convite":
{ Args: Record<PropertyKey, never>; Returns: {
              "atualizado_em": string,
"criado_em": string,
"email": string,
"id": string,
"matricula": string | null,
"nome": string,
"perfil": Database["public"]['Enums']["perfil"],
"status": Database["public"]['Enums']["status_usuario"]
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"alterar_perfil_usuario":
{ Args: { "p_id": string,"p_perfil": Database["public"]['Enums']["perfil"] }; Returns: {
              "atualizado_em": string,
"criado_em": string,
"email": string,
"id": string,
"matricula": string | null,
"nome": string,
"perfil": Database["public"]['Enums']["perfil"],
"status": Database["public"]['Enums']["status_usuario"]
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"alterar_status_usuario":
{ Args: { "p_id": string,"p_status": Database["public"]['Enums']["status_usuario"] }; Returns: {
              "atualizado_em": string,
"criado_em": string,
"email": string,
"id": string,
"matricula": string | null,
"nome": string,
"perfil": Database["public"]['Enums']["perfil"],
"status": Database["public"]['Enums']["status_usuario"]
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"aplicar_edicao_perfil":
{ Args: { "p_id": string,"p_matricula": string,"p_nome": string }; Returns: {
              "atualizado_em": string,
"criado_em": string,
"email": string,
"id": string,
"matricula": string | null,
"nome": string,
"perfil": Database["public"]['Enums']["perfil"],
"status": Database["public"]['Enums']["status_usuario"]
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"atualizar_meu_perfil":
{ Args: { "p_matricula": string,"p_nome": string }; Returns: {
              "atualizado_em": string,
"criado_em": string,
"email": string,
"id": string,
"matricula": string | null,
"nome": string,
"perfil": Database["public"]['Enums']["perfil"],
"status": Database["public"]['Enums']["status_usuario"]
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"atualizar_usuario":
{ Args: { "p_id": string,"p_matricula": string,"p_nome": string }; Returns: {
              "atualizado_em": string,
"criado_em": string,
"email": string,
"id": string,
"matricula": string | null,
"nome": string,
"perfil": Database["public"]['Enums']["perfil"],
"status": Database["public"]['Enums']["status_usuario"]
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"cancelar_convite":
{ Args: { "p_id": string }; Returns: {
              "aceito_em": string | null,
"cancelado_em": string | null,
"convidado_por": string,
"criado_em": string,
"email": string,
"expira_em": string,
"id": string,
"matricula": string | null,
"nome": string,
"perfil": Database["public"]['Enums']["perfil"]
            }
                          SetofOptions: {
        from: "*"
        to: "convite"
        isOneToOne: true
        isSetofReturn: false
      } },
"convidar_usuario":
{ Args: { "p_email": string,"p_matricula": string,"p_nome": string,"p_perfil"?: Database["public"]['Enums']["perfil"] }; Returns: {
              "aceito_em": string | null,
"cancelado_em": string | null,
"convidado_por": string,
"criado_em": string,
"email": string,
"expira_em": string,
"id": string,
"matricula": string | null,
"nome": string,
"perfil": Database["public"]['Enums']["perfil"]
            }
                          SetofOptions: {
        from: "*"
        to: "convite"
        isOneToOne: true
        isSetofReturn: false
      } },
"convite_em_aberto":
{ Args: { "c": Omit<Database["public"]['Tables']["convite"]['Row'], Database["public"]['Tables']["convite"]['ComputedFields']> }; Returns: boolean
                           },
"eh_admin_ativo":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"garantir_admin_ativo":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"matricula_em_uso":
{ Args: { "p_ignorar"?: string,"p_matricula": string }; Returns: boolean
                           },
"preparar_alteracao_usuario":
{ Args: { "p_id": string }; Returns: {
              "atualizado_em": string,
"criado_em": string,
"email": string,
"id": string,
"matricula": string | null,
"nome": string,
"perfil": Database["public"]['Enums']["perfil"],
"status": Database["public"]['Enums']["status_usuario"]
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"travar_email_convite":
{ Args: { "p_email": string }; Returns: undefined
                           },
"travar_matricula":
{ Args: { "p_matricula": string }; Returns: undefined
                           },
"usuario_ativo":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"validar_cadastro_por_convite":
{ Args: { "event": Json }; Returns: Json
                           }
          }
          Enums: {
            "perfil": "admin"|"solicitante","status_usuario": "pendente"|"ativo"|"inativo"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "perfil": ["admin", "solicitante"],"status_usuario": ["pendente", "ativo", "inativo"]
          }
        }
} as const
