
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
                },"item": {
                  Row: {
                    "ativo": boolean,"atualizado_em": string,"criado_em": string,"descricao": string | null,"estado": Database["public"]['Enums']["estado_item"] | null,"estoque_minimo": number | null,"id": string,"local_id": string,"nome": string,"numero_patrimonio": string | null,"operante": boolean,"quantidade_em_uso": number,"quantidade_reservada": number,"quantidade_total": number,"tipo_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo"?: boolean,"atualizado_em"?: string,"criado_em"?: string,"descricao"?: string | null,"estado"?: Database["public"]['Enums']["estado_item"] | null,"estoque_minimo"?: number | null,"id"?: string,"local_id": string,"nome": string,"numero_patrimonio"?: string | null,"operante"?: boolean,"quantidade_em_uso"?: number,"quantidade_reservada"?: number,"quantidade_total": number,"tipo_id": string
                  }
                  Update: {
                    "ativo"?: boolean,"atualizado_em"?: string,"criado_em"?: string,"descricao"?: string | null,"estado"?: Database["public"]['Enums']["estado_item"] | null,"estoque_minimo"?: number | null,"id"?: string,"local_id"?: string,"nome"?: string,"numero_patrimonio"?: string | null,"operante"?: boolean,"quantidade_em_uso"?: number,"quantidade_reservada"?: number,"quantidade_total"?: number,"tipo_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_local_id_fkey"
      columns: ["local_id"]
isOneToOne: false
      referencedRelation: "local"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "item_tipo_id_fkey"
      columns: ["tipo_id"]
isOneToOne: false
      referencedRelation: "tipo_item"
      referencedColumns: ["id"]
    }
                  ]
                },"local": {
                  Row: {
                    "ativo": boolean,"descricao": string | null,"id": string,"nome": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo"?: boolean,"descricao"?: string | null,"id"?: string,"nome": string
                  }
                  Update: {
                    "ativo"?: boolean,"descricao"?: string | null,"id"?: string,"nome"?: string
                  }
                  Relationships: [
                    
                  ]
                },"movimentacao": {
                  Row: {
                    "criado_em": string,"id": number,"item_id": string,"motivo": string | null,"quantidade": number,"solicitacao_id": string | null,"tipo": Database["public"]['Enums']["tipo_movimentacao"],"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"id"?: never,"item_id": string,"motivo"?: string | null,"quantidade": number,"solicitacao_id"?: string | null,"tipo": Database["public"]['Enums']["tipo_movimentacao"],"usuario_id": string
                  }
                  Update: {
                    "criado_em"?: string,"id"?: never,"item_id"?: string,"motivo"?: string | null,"quantidade"?: number,"solicitacao_id"?: string | null,"tipo"?: Database["public"]['Enums']["tipo_movimentacao"],"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "movimentacao_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "catalogo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimentacao_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "item"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimentacao_solicitacao_id_fkey"
      columns: ["solicitacao_id"]
isOneToOne: false
      referencedRelation: "aprovadas_aguardando_retirada"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimentacao_solicitacao_id_fkey"
      columns: ["solicitacao_id"]
isOneToOne: false
      referencedRelation: "fila_aprovacao"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimentacao_solicitacao_id_fkey"
      columns: ["solicitacao_id"]
isOneToOne: false
      referencedRelation: "solicitacao"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimentacao_usuario_id_fkey"
      columns: ["usuario_id"]
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
                },"solicitacao": {
                  Row: {
                    "aprovador_id": string | null,"cancelado_em": string | null,"cancelado_por_id": string | null,"criado_em": string,"data_decisao": string | null,"id": string,"justificativa": string,"motivo_cancelamento": string | null,"motivo_recusa": string | null,"observacao_decisao": string | null,"solicitante_id": string,"status": Database["public"]['Enums']["status_solicitacao"]
                  }
                  ComputedFields: never
                  Insert: {
                    "aprovador_id"?: string | null,"cancelado_em"?: string | null,"cancelado_por_id"?: string | null,"criado_em"?: string,"data_decisao"?: string | null,"id"?: string,"justificativa": string,"motivo_cancelamento"?: string | null,"motivo_recusa"?: string | null,"observacao_decisao"?: string | null,"solicitante_id": string,"status"?: Database["public"]['Enums']["status_solicitacao"]
                  }
                  Update: {
                    "aprovador_id"?: string | null,"cancelado_em"?: string | null,"cancelado_por_id"?: string | null,"criado_em"?: string,"data_decisao"?: string | null,"id"?: string,"justificativa"?: string,"motivo_cancelamento"?: string | null,"motivo_recusa"?: string | null,"observacao_decisao"?: string | null,"solicitante_id"?: string,"status"?: Database["public"]['Enums']["status_solicitacao"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "solicitacao_aprovador_id_fkey"
      columns: ["aprovador_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "solicitacao_cancelado_por_id_fkey"
      columns: ["cancelado_por_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "solicitacao_solicitante_id_fkey"
      columns: ["solicitante_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"solicitacao_item": {
                  Row: {
                    "id": string,"item_id": string,"item_nome": string,"quantidade_aprovada": number | null,"quantidade_solicitada": number,"solicitacao_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"item_id": string,"item_nome": string,"quantidade_aprovada"?: number | null,"quantidade_solicitada": number,"solicitacao_id": string
                  }
                  Update: {
                    "id"?: string,"item_id"?: string,"item_nome"?: string,"quantidade_aprovada"?: number | null,"quantidade_solicitada"?: number,"solicitacao_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "solicitacao_item_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "catalogo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "solicitacao_item_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "item"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "solicitacao_item_solicitacao_id_fkey"
      columns: ["solicitacao_id"]
isOneToOne: false
      referencedRelation: "aprovadas_aguardando_retirada"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "solicitacao_item_solicitacao_id_fkey"
      columns: ["solicitacao_id"]
isOneToOne: false
      referencedRelation: "fila_aprovacao"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "solicitacao_item_solicitacao_id_fkey"
      columns: ["solicitacao_id"]
isOneToOne: false
      referencedRelation: "solicitacao"
      referencedColumns: ["id"]
    }
                  ]
                },"tipo_item": {
                  Row: {
                    "ativo": boolean,"consumivel": boolean,"id": string,"nome": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo"?: boolean,"consumivel": boolean,"id"?: string,"nome": string
                  }
                  Update: {
                    "ativo"?: boolean,"consumivel"?: boolean,"id"?: string,"nome"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "aprovadas_aguardando_retirada": {
                  Row: {
                    "aprovador_nome": string | null,"criado_em": string | null,"data_decisao": string | null,"dias_aguardando": number | null,"id": string | null,"itens": Json | null,"justificativa": string | null,"observacao_decisao": string | null,"solicitante_id": string | null,"solicitante_nome": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "solicitacao_solicitante_id_fkey"
      columns: ["solicitante_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"catalogo": {
                  Row: {
                    "ativo": boolean | null,"atualizado_em": string | null,"consumivel": boolean | null,"descricao": string | null,"disponivel": number | null,"estado": Database["public"]['Enums']["estado_item"] | null,"estoque_minimo": number | null,"id": string | null,"local_id": string | null,"local_nome": string | null,"nome": string | null,"numero_patrimonio": string | null,"operante": boolean | null,"quantidade_em_uso": number | null,"quantidade_reservada": number | null,"quantidade_total": number | null,"tipo_id": string | null,"tipo_nome": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "item_local_id_fkey"
      columns: ["local_id"]
isOneToOne: false
      referencedRelation: "local"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "item_tipo_id_fkey"
      columns: ["tipo_id"]
isOneToOne: false
      referencedRelation: "tipo_item"
      referencedColumns: ["id"]
    }
                  ]
                },"convite_situacao": {
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
                },"fila_aprovacao": {
                  Row: {
                    "criado_em": string | null,"id": string | null,"itens": Json | null,"justificativa": string | null,"solicitante_id": string | null,"solicitante_nome": string | null,"solicitante_status": Database["public"]['Enums']["status_usuario"] | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "solicitacao_solicitante_id_fkey"
      columns: ["solicitante_id"]
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
"ajustar_quantidade_item":
{ Args: { "p_item_id": string,"p_motivo": string,"p_nova_quantidade": number }; Returns: {
              "ativo": boolean,
"atualizado_em": string,
"criado_em": string,
"descricao": string | null,
"estado": Database["public"]['Enums']["estado_item"] | null,
"estoque_minimo": number | null,
"id": string,
"local_id": string,
"nome": string,
"numero_patrimonio": string | null,
"operante": boolean,
"quantidade_em_uso": number,
"quantidade_reservada": number,
"quantidade_total": number,
"tipo_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "item"
        isOneToOne: true
        isSetofReturn: false
      } },
"alterar_operancia_item":
{ Args: { "p_item_id": string,"p_motivo"?: string,"p_operante": boolean }; Returns: {
              "ativo": boolean,
"atualizado_em": string,
"criado_em": string,
"descricao": string | null,
"estado": Database["public"]['Enums']["estado_item"] | null,
"estoque_minimo": number | null,
"id": string,
"local_id": string,
"nome": string,
"numero_patrimonio": string | null,
"operante": boolean,
"quantidade_em_uso": number,
"quantidade_reservada": number,
"quantidade_total": number,
"tipo_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "item"
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
"aprovar_solicitacao":
{ Args: { "p_id": string,"p_itens": Json,"p_observacao"?: string }; Returns: {
              "aprovador_id": string | null,
"cancelado_em": string | null,
"cancelado_por_id": string | null,
"criado_em": string,
"data_decisao": string | null,
"id": string,
"justificativa": string,
"motivo_cancelamento": string | null,
"motivo_recusa": string | null,
"observacao_decisao": string | null,
"solicitante_id": string,
"status": Database["public"]['Enums']["status_solicitacao"]
            }
                          SetofOptions: {
        from: "*"
        to: "solicitacao"
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
"cancelar_solicitacao":
{ Args: { "p_id": string }; Returns: {
              "aprovador_id": string | null,
"cancelado_em": string | null,
"cancelado_por_id": string | null,
"criado_em": string,
"data_decisao": string | null,
"id": string,
"justificativa": string,
"motivo_cancelamento": string | null,
"motivo_recusa": string | null,
"observacao_decisao": string | null,
"solicitante_id": string,
"status": Database["public"]['Enums']["status_solicitacao"]
            }
                          SetofOptions: {
        from: "*"
        to: "solicitacao"
        isOneToOne: true
        isSetofReturn: false
      } },
"cancelar_solicitacao_aprovada":
{ Args: { "p_id": string,"p_motivo": string }; Returns: {
              "aprovador_id": string | null,
"cancelado_em": string | null,
"cancelado_por_id": string | null,
"criado_em": string,
"data_decisao": string | null,
"id": string,
"justificativa": string,
"motivo_cancelamento": string | null,
"motivo_recusa": string | null,
"observacao_decisao": string | null,
"solicitante_id": string,
"status": Database["public"]['Enums']["status_solicitacao"]
            }
                          SetofOptions: {
        from: "*"
        to: "solicitacao"
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
"enviar_solicitacao":
{ Args: { "p_itens": Json,"p_justificativa": string }; Returns: string
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
"recusar_solicitacao":
{ Args: { "p_id": string,"p_motivo": string }; Returns: {
              "aprovador_id": string | null,
"cancelado_em": string | null,
"cancelado_por_id": string | null,
"criado_em": string,
"data_decisao": string | null,
"id": string,
"justificativa": string,
"motivo_cancelamento": string | null,
"motivo_recusa": string | null,
"observacao_decisao": string | null,
"solicitante_id": string,
"status": Database["public"]['Enums']["status_solicitacao"]
            }
                          SetofOptions: {
        from: "*"
        to: "solicitacao"
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
            "estado_item": "novo"|"bom"|"regular"|"ruim","perfil": "admin"|"solicitante","status_solicitacao": "pendente"|"aprovada"|"retirada"|"concluida"|"cancelada"|"recusada","status_usuario": "pendente"|"ativo"|"inativo","tipo_movimentacao": "ajuste"|"reserva"|"liberacao_reserva"|"retirada"|"devolucao"
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
            "estado_item": ["novo", "bom", "regular", "ruim"],"perfil": ["admin", "solicitante"],"status_solicitacao": ["pendente", "aprovada", "retirada", "concluida", "cancelada", "recusada"],"status_usuario": ["pendente", "ativo", "inativo"],"tipo_movimentacao": ["ajuste", "reserva", "liberacao_reserva", "retirada", "devolucao"]
          }
        }
} as const
