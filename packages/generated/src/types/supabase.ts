/* tslint:disable */
/* eslint-disable */
/**
 * This file was automatically generated and copied from ./packages/services/src/core/supabase/types.ts
 * DO NOT MODIFY IT BY HAND. Instead, regenerate the source file and re-run this script.
 *
 * Last updated: 2026-01-13T08:07:34.208Z
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      _pages_v: {
        Row: {
          autosave: boolean | null
          created_at: string
          id: number
          latest: boolean | null
          parent_id: number | null
          published_locale: Database['public']['Enums']['enum__pages_v_published_locale'] | null
          snapshot: boolean | null
          updated_at: string
          version__status: Database['public']['Enums']['enum__pages_v_version_status'] | null
          version_created_at: string | null
          version_hero_media_id: number | null
          version_hero_rich_text: Json | null
          version_hero_type: Database['public']['Enums']['enum__pages_v_version_hero_type'] | null
          version_meta_description: string | null
          version_meta_image_id: number | null
          version_meta_title: string | null
          version_published_at: string | null
          version_slug: string | null
          version_slug_lock: boolean | null
          version_title: string | null
          version_updated_at: string | null
        }
        Insert: {
          autosave?: boolean | null
          created_at?: string
          id?: number
          latest?: boolean | null
          parent_id?: number | null
          published_locale?: Database['public']['Enums']['enum__pages_v_published_locale'] | null
          snapshot?: boolean | null
          updated_at?: string
          version__status?: Database['public']['Enums']['enum__pages_v_version_status'] | null
          version_created_at?: string | null
          version_hero_media_id?: number | null
          version_hero_rich_text?: Json | null
          version_hero_type?: Database['public']['Enums']['enum__pages_v_version_hero_type'] | null
          version_meta_description?: string | null
          version_meta_image_id?: number | null
          version_meta_title?: string | null
          version_published_at?: string | null
          version_slug?: string | null
          version_slug_lock?: boolean | null
          version_title?: string | null
          version_updated_at?: string | null
        }
        Update: {
          autosave?: boolean | null
          created_at?: string
          id?: number
          latest?: boolean | null
          parent_id?: number | null
          published_locale?: Database['public']['Enums']['enum__pages_v_published_locale'] | null
          snapshot?: boolean | null
          updated_at?: string
          version__status?: Database['public']['Enums']['enum__pages_v_version_status'] | null
          version_created_at?: string | null
          version_hero_media_id?: number | null
          version_hero_rich_text?: Json | null
          version_hero_type?: Database['public']['Enums']['enum__pages_v_version_hero_type'] | null
          version_meta_description?: string | null
          version_meta_image_id?: number | null
          version_meta_title?: string | null
          version_published_at?: string | null
          version_slug?: string | null
          version_slug_lock?: boolean | null
          version_title?: string | null
          version_updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: '_pages_v_parent_id_pages_id_fk'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: '_pages_v_version_hero_media_id_media_id_fk'
            columns: ['version_hero_media_id']
            isOneToOne: false
            referencedRelation: 'media'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: '_pages_v_version_meta_image_id_media_id_fk'
            columns: ['version_meta_image_id']
            isOneToOne: false
            referencedRelation: 'media'
            referencedColumns: ['id']
          },
        ]
      }
      _pages_v_blocks_archive: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          _uuid: string | null
          block_name: string | null
          id: number
          intro_content: Json | null
          limit: number | null
          populate_by:
            | Database['public']['Enums']['enum__pages_v_blocks_archive_populate_by']
            | null
          relation_to:
            | Database['public']['Enums']['enum__pages_v_blocks_archive_relation_to']
            | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          _uuid?: string | null
          block_name?: string | null
          id?: number
          intro_content?: Json | null
          limit?: number | null
          populate_by?:
            | Database['public']['Enums']['enum__pages_v_blocks_archive_populate_by']
            | null
          relation_to?:
            | Database['public']['Enums']['enum__pages_v_blocks_archive_relation_to']
            | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          _uuid?: string | null
          block_name?: string | null
          id?: number
          intro_content?: Json | null
          limit?: number | null
          populate_by?:
            | Database['public']['Enums']['enum__pages_v_blocks_archive_populate_by']
            | null
          relation_to?:
            | Database['public']['Enums']['enum__pages_v_blocks_archive_relation_to']
            | null
        }
        Relationships: [
          {
            foreignKeyName: '_pages_v_blocks_archive_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: '_pages_v'
            referencedColumns: ['id']
          },
        ]
      }
      _pages_v_blocks_banner: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          _uuid: string | null
          block_name: string | null
          content: Json | null
          id: number
          style: Database['public']['Enums']['enum__pages_v_blocks_banner_style'] | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          _uuid?: string | null
          block_name?: string | null
          content?: Json | null
          id?: number
          style?: Database['public']['Enums']['enum__pages_v_blocks_banner_style'] | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          _uuid?: string | null
          block_name?: string | null
          content?: Json | null
          id?: number
          style?: Database['public']['Enums']['enum__pages_v_blocks_banner_style'] | null
        }
        Relationships: [
          {
            foreignKeyName: '_pages_v_blocks_banner_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: '_pages_v'
            referencedColumns: ['id']
          },
        ]
      }
      _pages_v_blocks_code: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          _uuid: string | null
          block_name: string | null
          code: string | null
          id: number
          language: Database['public']['Enums']['enum__pages_v_blocks_code_language'] | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          _uuid?: string | null
          block_name?: string | null
          code?: string | null
          id?: number
          language?: Database['public']['Enums']['enum__pages_v_blocks_code_language'] | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          _uuid?: string | null
          block_name?: string | null
          code?: string | null
          id?: number
          language?: Database['public']['Enums']['enum__pages_v_blocks_code_language'] | null
        }
        Relationships: [
          {
            foreignKeyName: '_pages_v_blocks_code_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: '_pages_v'
            referencedColumns: ['id']
          },
        ]
      }
      _pages_v_blocks_content: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          _uuid: string | null
          block_name: string | null
          id: number
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          _uuid?: string | null
          block_name?: string | null
          id?: number
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          _uuid?: string | null
          block_name?: string | null
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: '_pages_v_blocks_content_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: '_pages_v'
            referencedColumns: ['id']
          },
        ]
      }
      _pages_v_blocks_content_columns: {
        Row: {
          _order: number
          _parent_id: number
          _uuid: string | null
          enable_link: boolean | null
          id: number
          link_appearance:
            | Database['public']['Enums']['enum__pages_v_blocks_content_columns_link_appearance']
            | null
          link_label: string | null
          link_new_tab: boolean | null
          link_type:
            | Database['public']['Enums']['enum__pages_v_blocks_content_columns_link_type']
            | null
          link_url: string | null
          rich_text: Json | null
          size: Database['public']['Enums']['enum__pages_v_blocks_content_columns_size'] | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _uuid?: string | null
          enable_link?: boolean | null
          id?: number
          link_appearance?:
            | Database['public']['Enums']['enum__pages_v_blocks_content_columns_link_appearance']
            | null
          link_label?: string | null
          link_new_tab?: boolean | null
          link_type?:
            | Database['public']['Enums']['enum__pages_v_blocks_content_columns_link_type']
            | null
          link_url?: string | null
          rich_text?: Json | null
          size?: Database['public']['Enums']['enum__pages_v_blocks_content_columns_size'] | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _uuid?: string | null
          enable_link?: boolean | null
          id?: number
          link_appearance?:
            | Database['public']['Enums']['enum__pages_v_blocks_content_columns_link_appearance']
            | null
          link_label?: string | null
          link_new_tab?: boolean | null
          link_type?:
            | Database['public']['Enums']['enum__pages_v_blocks_content_columns_link_type']
            | null
          link_url?: string | null
          rich_text?: Json | null
          size?: Database['public']['Enums']['enum__pages_v_blocks_content_columns_size'] | null
        }
        Relationships: [
          {
            foreignKeyName: '_pages_v_blocks_content_columns_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: '_pages_v_blocks_content'
            referencedColumns: ['id']
          },
        ]
      }
      _pages_v_blocks_cta: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          _uuid: string | null
          block_name: string | null
          id: number
          rich_text: Json | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          _uuid?: string | null
          block_name?: string | null
          id?: number
          rich_text?: Json | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          _uuid?: string | null
          block_name?: string | null
          id?: number
          rich_text?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: '_pages_v_blocks_cta_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: '_pages_v'
            referencedColumns: ['id']
          },
        ]
      }
      _pages_v_blocks_cta_links: {
        Row: {
          _order: number
          _parent_id: number
          _uuid: string | null
          id: number
          link_appearance:
            | Database['public']['Enums']['enum__pages_v_blocks_cta_links_link_appearance']
            | null
          link_label: string | null
          link_new_tab: boolean | null
          link_type: Database['public']['Enums']['enum__pages_v_blocks_cta_links_link_type'] | null
          link_url: string | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _uuid?: string | null
          id?: number
          link_appearance?:
            | Database['public']['Enums']['enum__pages_v_blocks_cta_links_link_appearance']
            | null
          link_label?: string | null
          link_new_tab?: boolean | null
          link_type?: Database['public']['Enums']['enum__pages_v_blocks_cta_links_link_type'] | null
          link_url?: string | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _uuid?: string | null
          id?: number
          link_appearance?:
            | Database['public']['Enums']['enum__pages_v_blocks_cta_links_link_appearance']
            | null
          link_label?: string | null
          link_new_tab?: boolean | null
          link_type?: Database['public']['Enums']['enum__pages_v_blocks_cta_links_link_type'] | null
          link_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: '_pages_v_blocks_cta_links_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: '_pages_v_blocks_cta'
            referencedColumns: ['id']
          },
        ]
      }
      _pages_v_blocks_form_block: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          _uuid: string | null
          block_name: string | null
          enable_intro: boolean | null
          form_id: number | null
          id: number
          intro_content: Json | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          _uuid?: string | null
          block_name?: string | null
          enable_intro?: boolean | null
          form_id?: number | null
          id?: number
          intro_content?: Json | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          _uuid?: string | null
          block_name?: string | null
          enable_intro?: boolean | null
          form_id?: number | null
          id?: number
          intro_content?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: '_pages_v_blocks_form_block_form_id_forms_id_fk'
            columns: ['form_id']
            isOneToOne: false
            referencedRelation: 'forms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: '_pages_v_blocks_form_block_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: '_pages_v'
            referencedColumns: ['id']
          },
        ]
      }
      _pages_v_blocks_media_block: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          _uuid: string | null
          block_name: string | null
          id: number
          media_id: number | null
          position: Database['public']['Enums']['enum__pages_v_blocks_media_block_position'] | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          _uuid?: string | null
          block_name?: string | null
          id?: number
          media_id?: number | null
          position?: Database['public']['Enums']['enum__pages_v_blocks_media_block_position'] | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          _uuid?: string | null
          block_name?: string | null
          id?: number
          media_id?: number | null
          position?: Database['public']['Enums']['enum__pages_v_blocks_media_block_position'] | null
        }
        Relationships: [
          {
            foreignKeyName: '_pages_v_blocks_media_block_media_id_media_id_fk'
            columns: ['media_id']
            isOneToOne: false
            referencedRelation: 'media'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: '_pages_v_blocks_media_block_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: '_pages_v'
            referencedColumns: ['id']
          },
        ]
      }
      _pages_v_rels: {
        Row: {
          categories_id: number | null
          id: number
          order: number | null
          pages_id: number | null
          parent_id: number
          path: string
          posts_id: number | null
        }
        Insert: {
          categories_id?: number | null
          id?: number
          order?: number | null
          pages_id?: number | null
          parent_id: number
          path: string
          posts_id?: number | null
        }
        Update: {
          categories_id?: number | null
          id?: number
          order?: number | null
          pages_id?: number | null
          parent_id?: number
          path?: string
          posts_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: '_pages_v_rels_categories_fk'
            columns: ['categories_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: '_pages_v_rels_pages_fk'
            columns: ['pages_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: '_pages_v_rels_parent_fk'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: '_pages_v'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: '_pages_v_rels_posts_fk'
            columns: ['posts_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
        ]
      }
      _pages_v_version_hero_links: {
        Row: {
          _order: number
          _parent_id: number
          _uuid: string | null
          id: number
          link_appearance:
            | Database['public']['Enums']['enum__pages_v_version_hero_links_link_appearance']
            | null
          link_label: string | null
          link_new_tab: boolean | null
          link_type:
            | Database['public']['Enums']['enum__pages_v_version_hero_links_link_type']
            | null
          link_url: string | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _uuid?: string | null
          id?: number
          link_appearance?:
            | Database['public']['Enums']['enum__pages_v_version_hero_links_link_appearance']
            | null
          link_label?: string | null
          link_new_tab?: boolean | null
          link_type?:
            | Database['public']['Enums']['enum__pages_v_version_hero_links_link_type']
            | null
          link_url?: string | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _uuid?: string | null
          id?: number
          link_appearance?:
            | Database['public']['Enums']['enum__pages_v_version_hero_links_link_appearance']
            | null
          link_label?: string | null
          link_new_tab?: boolean | null
          link_type?:
            | Database['public']['Enums']['enum__pages_v_version_hero_links_link_type']
            | null
          link_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: '_pages_v_version_hero_links_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: '_pages_v'
            referencedColumns: ['id']
          },
        ]
      }
      _posts_v: {
        Row: {
          autosave: boolean | null
          created_at: string
          id: number
          latest: boolean | null
          parent_id: number | null
          published_locale: Database['public']['Enums']['enum__posts_v_published_locale'] | null
          snapshot: boolean | null
          updated_at: string
          version__status: Database['public']['Enums']['enum__posts_v_version_status'] | null
          version_content: Json | null
          version_created_at: string | null
          version_meta_description: string | null
          version_meta_image_id: number | null
          version_meta_title: string | null
          version_published_at: string | null
          version_slug: string | null
          version_slug_lock: boolean | null
          version_title: string | null
          version_updated_at: string | null
        }
        Insert: {
          autosave?: boolean | null
          created_at?: string
          id?: number
          latest?: boolean | null
          parent_id?: number | null
          published_locale?: Database['public']['Enums']['enum__posts_v_published_locale'] | null
          snapshot?: boolean | null
          updated_at?: string
          version__status?: Database['public']['Enums']['enum__posts_v_version_status'] | null
          version_content?: Json | null
          version_created_at?: string | null
          version_meta_description?: string | null
          version_meta_image_id?: number | null
          version_meta_title?: string | null
          version_published_at?: string | null
          version_slug?: string | null
          version_slug_lock?: boolean | null
          version_title?: string | null
          version_updated_at?: string | null
        }
        Update: {
          autosave?: boolean | null
          created_at?: string
          id?: number
          latest?: boolean | null
          parent_id?: number | null
          published_locale?: Database['public']['Enums']['enum__posts_v_published_locale'] | null
          snapshot?: boolean | null
          updated_at?: string
          version__status?: Database['public']['Enums']['enum__posts_v_version_status'] | null
          version_content?: Json | null
          version_created_at?: string | null
          version_meta_description?: string | null
          version_meta_image_id?: number | null
          version_meta_title?: string | null
          version_published_at?: string | null
          version_slug?: string | null
          version_slug_lock?: boolean | null
          version_title?: string | null
          version_updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: '_posts_v_parent_id_posts_id_fk'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: '_posts_v_version_meta_image_id_media_id_fk'
            columns: ['version_meta_image_id']
            isOneToOne: false
            referencedRelation: 'media'
            referencedColumns: ['id']
          },
        ]
      }
      _posts_v_rels: {
        Row: {
          categories_id: number | null
          id: number
          order: number | null
          parent_id: number
          path: string
          posts_id: number | null
          users_id: number | null
        }
        Insert: {
          categories_id?: number | null
          id?: number
          order?: number | null
          parent_id: number
          path: string
          posts_id?: number | null
          users_id?: number | null
        }
        Update: {
          categories_id?: number | null
          id?: number
          order?: number | null
          parent_id?: number
          path?: string
          posts_id?: number | null
          users_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: '_posts_v_rels_categories_fk'
            columns: ['categories_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: '_posts_v_rels_parent_fk'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: '_posts_v'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: '_posts_v_rels_posts_fk'
            columns: ['posts_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: '_posts_v_rels_users_fk'
            columns: ['users_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      _posts_v_version_populated_authors: {
        Row: {
          _order: number
          _parent_id: number
          _uuid: string | null
          id: number
          name: string | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _uuid?: string | null
          id?: number
          name?: string | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _uuid?: string | null
          id?: number
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: '_posts_v_version_populated_authors_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: '_posts_v'
            referencedColumns: ['id']
          },
        ]
      }
      _prices_v: {
        Row: {
          created_at: string
          id: number
          latest: boolean | null
          parent_id: number | null
          published_locale: Database['public']['Enums']['enum__prices_v_published_locale'] | null
          snapshot: boolean | null
          updated_at: string
          version__status: Database['public']['Enums']['enum__prices_v_version_status'] | null
          version_created_at: string | null
          version_enable_paywall: boolean | null
          version_price_j_s_o_n: string | null
          version_published_on: string | null
          version_skip_sync: boolean | null
          version_stripe_price_i_d: string | null
          version_title: string | null
          version_updated_at: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          latest?: boolean | null
          parent_id?: number | null
          published_locale?: Database['public']['Enums']['enum__prices_v_published_locale'] | null
          snapshot?: boolean | null
          updated_at?: string
          version__status?: Database['public']['Enums']['enum__prices_v_version_status'] | null
          version_created_at?: string | null
          version_enable_paywall?: boolean | null
          version_price_j_s_o_n?: string | null
          version_published_on?: string | null
          version_skip_sync?: boolean | null
          version_stripe_price_i_d?: string | null
          version_title?: string | null
          version_updated_at?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          latest?: boolean | null
          parent_id?: number | null
          published_locale?: Database['public']['Enums']['enum__prices_v_published_locale'] | null
          snapshot?: boolean | null
          updated_at?: string
          version__status?: Database['public']['Enums']['enum__prices_v_version_status'] | null
          version_created_at?: string | null
          version_enable_paywall?: boolean | null
          version_price_j_s_o_n?: string | null
          version_published_on?: string | null
          version_skip_sync?: boolean | null
          version_stripe_price_i_d?: string | null
          version_title?: string | null
          version_updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: '_prices_v_parent_id_prices_id_fk'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'prices'
            referencedColumns: ['id']
          },
        ]
      }
      _prices_v_blocks_archive: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          _uuid: string | null
          block_name: string | null
          id: number
          intro_content: Json | null
          limit: number | null
          populate_by:
            | Database['public']['Enums']['enum__prices_v_blocks_archive_populate_by']
            | null
          relation_to:
            | Database['public']['Enums']['enum__prices_v_blocks_archive_relation_to']
            | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          _uuid?: string | null
          block_name?: string | null
          id?: number
          intro_content?: Json | null
          limit?: number | null
          populate_by?:
            | Database['public']['Enums']['enum__prices_v_blocks_archive_populate_by']
            | null
          relation_to?:
            | Database['public']['Enums']['enum__prices_v_blocks_archive_relation_to']
            | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          _uuid?: string | null
          block_name?: string | null
          id?: number
          intro_content?: Json | null
          limit?: number | null
          populate_by?:
            | Database['public']['Enums']['enum__prices_v_blocks_archive_populate_by']
            | null
          relation_to?:
            | Database['public']['Enums']['enum__prices_v_blocks_archive_relation_to']
            | null
        }
        Relationships: [
          {
            foreignKeyName: '_prices_v_blocks_archive_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: '_prices_v'
            referencedColumns: ['id']
          },
        ]
      }
      _prices_v_blocks_cta: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          _uuid: string | null
          block_name: string | null
          id: number
          rich_text: Json | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          _uuid?: string | null
          block_name?: string | null
          id?: number
          rich_text?: Json | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          _uuid?: string | null
          block_name?: string | null
          id?: number
          rich_text?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: '_prices_v_blocks_cta_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: '_prices_v'
            referencedColumns: ['id']
          },
        ]
      }
      _prices_v_blocks_cta_links: {
        Row: {
          _order: number
          _parent_id: number
          _uuid: string | null
          id: number
          link_appearance:
            | Database['public']['Enums']['enum__prices_v_blocks_cta_links_link_appearance']
            | null
          link_label: string | null
          link_new_tab: boolean | null
          link_type: Database['public']['Enums']['enum__prices_v_blocks_cta_links_link_type'] | null
          link_url: string | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _uuid?: string | null
          id?: number
          link_appearance?:
            | Database['public']['Enums']['enum__prices_v_blocks_cta_links_link_appearance']
            | null
          link_label?: string | null
          link_new_tab?: boolean | null
          link_type?:
            | Database['public']['Enums']['enum__prices_v_blocks_cta_links_link_type']
            | null
          link_url?: string | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _uuid?: string | null
          id?: number
          link_appearance?:
            | Database['public']['Enums']['enum__prices_v_blocks_cta_links_link_appearance']
            | null
          link_label?: string | null
          link_new_tab?: boolean | null
          link_type?:
            | Database['public']['Enums']['enum__prices_v_blocks_cta_links_link_type']
            | null
          link_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: '_prices_v_blocks_cta_links_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: '_prices_v_blocks_cta'
            referencedColumns: ['id']
          },
        ]
      }
      _prices_v_blocks_media_block: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          _uuid: string | null
          block_name: string | null
          id: number
          media_id: number | null
          position: Database['public']['Enums']['enum__prices_v_blocks_media_block_position'] | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          _uuid?: string | null
          block_name?: string | null
          id?: number
          media_id?: number | null
          position?:
            | Database['public']['Enums']['enum__prices_v_blocks_media_block_position']
            | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          _uuid?: string | null
          block_name?: string | null
          id?: number
          media_id?: number | null
          position?:
            | Database['public']['Enums']['enum__prices_v_blocks_media_block_position']
            | null
        }
        Relationships: [
          {
            foreignKeyName: '_prices_v_blocks_media_block_media_id_media_id_fk'
            columns: ['media_id']
            isOneToOne: false
            referencedRelation: 'media'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: '_prices_v_blocks_media_block_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: '_prices_v'
            referencedColumns: ['id']
          },
        ]
      }
      _prices_v_rels: {
        Row: {
          categories_id: number | null
          id: number
          order: number | null
          pages_id: number | null
          parent_id: number
          path: string
          posts_id: number | null
          prices_id: number | null
        }
        Insert: {
          categories_id?: number | null
          id?: number
          order?: number | null
          pages_id?: number | null
          parent_id: number
          path: string
          posts_id?: number | null
          prices_id?: number | null
        }
        Update: {
          categories_id?: number | null
          id?: number
          order?: number | null
          pages_id?: number | null
          parent_id?: number
          path?: string
          posts_id?: number | null
          prices_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: '_prices_v_rels_categories_fk'
            columns: ['categories_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: '_prices_v_rels_pages_fk'
            columns: ['pages_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: '_prices_v_rels_parent_fk'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: '_prices_v'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: '_prices_v_rels_posts_fk'
            columns: ['posts_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: '_prices_v_rels_prices_fk'
            columns: ['prices_id']
            isOneToOne: false
            referencedRelation: 'prices'
            referencedColumns: ['id']
          },
        ]
      }
      _products_v: {
        Row: {
          created_at: string
          id: number
          latest: boolean | null
          parent_id: number | null
          published_locale: Database['public']['Enums']['enum__products_v_published_locale'] | null
          snapshot: boolean | null
          updated_at: string
          version__status: Database['public']['Enums']['enum__products_v_version_status'] | null
          version_created_at: string | null
          version_enable_paywall: boolean | null
          version_price_j_s_o_n: string | null
          version_published_on: string | null
          version_skip_sync: boolean | null
          version_stripe_product_i_d: string | null
          version_title: string | null
          version_updated_at: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          latest?: boolean | null
          parent_id?: number | null
          published_locale?: Database['public']['Enums']['enum__products_v_published_locale'] | null
          snapshot?: boolean | null
          updated_at?: string
          version__status?: Database['public']['Enums']['enum__products_v_version_status'] | null
          version_created_at?: string | null
          version_enable_paywall?: boolean | null
          version_price_j_s_o_n?: string | null
          version_published_on?: string | null
          version_skip_sync?: boolean | null
          version_stripe_product_i_d?: string | null
          version_title?: string | null
          version_updated_at?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          latest?: boolean | null
          parent_id?: number | null
          published_locale?: Database['public']['Enums']['enum__products_v_published_locale'] | null
          snapshot?: boolean | null
          updated_at?: string
          version__status?: Database['public']['Enums']['enum__products_v_version_status'] | null
          version_created_at?: string | null
          version_enable_paywall?: boolean | null
          version_price_j_s_o_n?: string | null
          version_published_on?: string | null
          version_skip_sync?: boolean | null
          version_stripe_product_i_d?: string | null
          version_title?: string | null
          version_updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: '_products_v_parent_id_products_id_fk'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      _products_v_blocks_archive: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          _uuid: string | null
          block_name: string | null
          id: number
          intro_content: Json | null
          limit: number | null
          populate_by:
            | Database['public']['Enums']['enum__products_v_blocks_archive_populate_by']
            | null
          relation_to:
            | Database['public']['Enums']['enum__products_v_blocks_archive_relation_to']
            | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          _uuid?: string | null
          block_name?: string | null
          id?: number
          intro_content?: Json | null
          limit?: number | null
          populate_by?:
            | Database['public']['Enums']['enum__products_v_blocks_archive_populate_by']
            | null
          relation_to?:
            | Database['public']['Enums']['enum__products_v_blocks_archive_relation_to']
            | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          _uuid?: string | null
          block_name?: string | null
          id?: number
          intro_content?: Json | null
          limit?: number | null
          populate_by?:
            | Database['public']['Enums']['enum__products_v_blocks_archive_populate_by']
            | null
          relation_to?:
            | Database['public']['Enums']['enum__products_v_blocks_archive_relation_to']
            | null
        }
        Relationships: [
          {
            foreignKeyName: '_products_v_blocks_archive_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: '_products_v'
            referencedColumns: ['id']
          },
        ]
      }
      _products_v_blocks_cta: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          _uuid: string | null
          block_name: string | null
          id: number
          rich_text: Json | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          _uuid?: string | null
          block_name?: string | null
          id?: number
          rich_text?: Json | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          _uuid?: string | null
          block_name?: string | null
          id?: number
          rich_text?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: '_products_v_blocks_cta_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: '_products_v'
            referencedColumns: ['id']
          },
        ]
      }
      _products_v_blocks_cta_links: {
        Row: {
          _order: number
          _parent_id: number
          _uuid: string | null
          id: number
          link_appearance:
            | Database['public']['Enums']['enum__products_v_blocks_cta_links_link_appearance']
            | null
          link_label: string | null
          link_new_tab: boolean | null
          link_type:
            | Database['public']['Enums']['enum__products_v_blocks_cta_links_link_type']
            | null
          link_url: string | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _uuid?: string | null
          id?: number
          link_appearance?:
            | Database['public']['Enums']['enum__products_v_blocks_cta_links_link_appearance']
            | null
          link_label?: string | null
          link_new_tab?: boolean | null
          link_type?:
            | Database['public']['Enums']['enum__products_v_blocks_cta_links_link_type']
            | null
          link_url?: string | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _uuid?: string | null
          id?: number
          link_appearance?:
            | Database['public']['Enums']['enum__products_v_blocks_cta_links_link_appearance']
            | null
          link_label?: string | null
          link_new_tab?: boolean | null
          link_type?:
            | Database['public']['Enums']['enum__products_v_blocks_cta_links_link_type']
            | null
          link_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: '_products_v_blocks_cta_links_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: '_products_v_blocks_cta'
            referencedColumns: ['id']
          },
        ]
      }
      _products_v_blocks_media_block: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          _uuid: string | null
          block_name: string | null
          id: number
          media_id: number | null
          position:
            | Database['public']['Enums']['enum__products_v_blocks_media_block_position']
            | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          _uuid?: string | null
          block_name?: string | null
          id?: number
          media_id?: number | null
          position?:
            | Database['public']['Enums']['enum__products_v_blocks_media_block_position']
            | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          _uuid?: string | null
          block_name?: string | null
          id?: number
          media_id?: number | null
          position?:
            | Database['public']['Enums']['enum__products_v_blocks_media_block_position']
            | null
        }
        Relationships: [
          {
            foreignKeyName: '_products_v_blocks_media_block_media_id_media_id_fk'
            columns: ['media_id']
            isOneToOne: false
            referencedRelation: 'media'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: '_products_v_blocks_media_block_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: '_products_v'
            referencedColumns: ['id']
          },
        ]
      }
      _products_v_rels: {
        Row: {
          categories_id: number | null
          id: number
          order: number | null
          pages_id: number | null
          parent_id: number
          path: string
          posts_id: number | null
          products_id: number | null
        }
        Insert: {
          categories_id?: number | null
          id?: number
          order?: number | null
          pages_id?: number | null
          parent_id: number
          path: string
          posts_id?: number | null
          products_id?: number | null
        }
        Update: {
          categories_id?: number | null
          id?: number
          order?: number | null
          pages_id?: number | null
          parent_id?: number
          path?: string
          posts_id?: number | null
          products_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: '_products_v_rels_categories_fk'
            columns: ['categories_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: '_products_v_rels_pages_fk'
            columns: ['pages_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: '_products_v_rels_parent_fk'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: '_products_v'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: '_products_v_rels_posts_fk'
            columns: ['posts_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: '_products_v_rels_products_fk'
            columns: ['products_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      banners: {
        Row: {
          alt: string | null
          created_at: string
          cta: string | null
          description: string | null
          heading: string | null
          highlight: string | null
          id: number
          image_id: number | null
          link_href: string | null
          link_text: string | null
          punctuation: string | null
          subheading: string | null
          updated_at: string
        }
        Insert: {
          alt?: string | null
          created_at?: string
          cta?: string | null
          description?: string | null
          heading?: string | null
          highlight?: string | null
          id?: number
          image_id?: number | null
          link_href?: string | null
          link_text?: string | null
          punctuation?: string | null
          subheading?: string | null
          updated_at?: string
        }
        Update: {
          alt?: string | null
          created_at?: string
          cta?: string | null
          description?: string | null
          heading?: string | null
          highlight?: string | null
          id?: number
          image_id?: number | null
          link_href?: string | null
          link_text?: string | null
          punctuation?: string | null
          subheading?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'banners_image_id_media_id_fk'
            columns: ['image_id']
            isOneToOne: false
            referencedRelation: 'media'
            referencedColumns: ['id']
          },
        ]
      }
      banners_stats: {
        Row: {
          _order: number
          _parent_id: number
          id: string
          label: string | null
          value: string | null
        }
        Insert: {
          _order: number
          _parent_id: number
          id: string
          label?: string | null
          value?: string | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          id?: string
          label?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'banners_stats_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'banners'
            referencedColumns: ['id']
          },
        ]
      }
      cards: {
        Row: {
          created_at: string
          cta: string | null
          href: string | null
          id: number
          image_id: number | null
          label: string | null
          loading: Database['public']['Enums']['enum_cards_loading'] | null
          name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta?: string | null
          href?: string | null
          id?: number
          image_id?: number | null
          label?: string | null
          loading?: Database['public']['Enums']['enum_cards_loading'] | null
          name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta?: string | null
          href?: string | null
          id?: number
          image_id?: number | null
          label?: string | null
          loading?: Database['public']['Enums']['enum_cards_loading'] | null
          name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'cards_image_id_media_id_fk'
            columns: ['image_id']
            isOneToOne: false
            referencedRelation: 'media'
            referencedColumns: ['id']
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: number
          parent_id: number | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          parent_id?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          parent_id?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'categories_parent_id_categories_id_fk'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
      }
      categories_breadcrumbs: {
        Row: {
          _locale: unknown[]
          _order: number
          _parent_id: number
          doc_id: number | null
          id: string
          label: string | null
          url: string | null
        }
        Insert: {
          _locale: unknown[]
          _order: number
          _parent_id: number
          doc_id?: number | null
          id: string
          label?: string | null
          url?: string | null
        }
        Update: {
          _locale?: unknown[]
          _order?: number
          _parent_id?: number
          doc_id?: number | null
          id?: string
          label?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'categories_breadcrumbs_doc_id_categories_id_fk'
            columns: ['doc_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'categories_breadcrumbs_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
      }
      contents: {
        Row: {
          created_at: string
          description: string | null
          id: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          alt: string | null
          created_at: string
          description: string | null
          id: number
          image_id: number | null
          name: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          alt?: string | null
          created_at?: string
          description?: string | null
          id?: number
          image_id?: number | null
          name?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          alt?: string | null
          created_at?: string
          description?: string | null
          id?: number
          image_id?: number | null
          name?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'events_image_id_media_id_fk'
            columns: ['image_id']
            isOneToOne: false
            referencedRelation: 'media'
            referencedColumns: ['id']
          },
        ]
      }
      footer: {
        Row: {
          created_at: string | null
          id: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      footer_nav_items: {
        Row: {
          _order: number
          _parent_id: number
          id: string
          link_label: string
          link_new_tab: boolean | null
          link_type: Database['public']['Enums']['enum_footer_nav_items_link_type'] | null
          link_url: string | null
        }
        Insert: {
          _order: number
          _parent_id: number
          id: string
          link_label: string
          link_new_tab?: boolean | null
          link_type?: Database['public']['Enums']['enum_footer_nav_items_link_type'] | null
          link_url?: string | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          id?: string
          link_label?: string
          link_new_tab?: boolean | null
          link_type?: Database['public']['Enums']['enum_footer_nav_items_link_type'] | null
          link_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'footer_nav_items_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'footer'
            referencedColumns: ['id']
          },
        ]
      }
      footer_rels: {
        Row: {
          id: number
          order: number | null
          pages_id: number | null
          parent_id: number
          path: string
        }
        Insert: {
          id?: number
          order?: number | null
          pages_id?: number | null
          parent_id: number
          path: string
        }
        Update: {
          id?: number
          order?: number | null
          pages_id?: number | null
          parent_id?: number
          path?: string
        }
        Relationships: [
          {
            foreignKeyName: 'footer_rels_pages_fk'
            columns: ['pages_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'footer_rels_parent_fk'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'footer'
            referencedColumns: ['id']
          },
        ]
      }
      form_submissions: {
        Row: {
          created_at: string
          form_id: number
          id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          form_id: number
          id?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          form_id?: number
          id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'form_submissions_form_id_forms_id_fk'
            columns: ['form_id']
            isOneToOne: false
            referencedRelation: 'forms'
            referencedColumns: ['id']
          },
        ]
      }
      form_submissions_submission_data: {
        Row: {
          _order: number
          _parent_id: number
          field: string
          id: string
          value: string
        }
        Insert: {
          _order: number
          _parent_id: number
          field: string
          id: string
          value: string
        }
        Update: {
          _order?: number
          _parent_id?: number
          field?: string
          id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: 'form_submissions_submission_data_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'form_submissions'
            referencedColumns: ['id']
          },
        ]
      }
      forms: {
        Row: {
          confirmation_type: Database['public']['Enums']['enum_forms_confirmation_type'] | null
          created_at: string
          id: number
          redirect_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          confirmation_type?: Database['public']['Enums']['enum_forms_confirmation_type'] | null
          created_at?: string
          id?: number
          redirect_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          confirmation_type?: Database['public']['Enums']['enum_forms_confirmation_type'] | null
          created_at?: string
          id?: number
          redirect_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      forms_blocks_checkbox: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          block_name: string | null
          default_value: boolean | null
          id: string
          name: string
          required: boolean | null
          width: number | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          block_name?: string | null
          default_value?: boolean | null
          id: string
          name: string
          required?: boolean | null
          width?: number | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          block_name?: string | null
          default_value?: boolean | null
          id?: string
          name?: string
          required?: boolean | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'forms_blocks_checkbox_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'forms'
            referencedColumns: ['id']
          },
        ]
      }
      forms_blocks_checkbox_locales: {
        Row: {
          _locale: unknown[]
          _parent_id: string
          id: number
          label: string | null
        }
        Insert: {
          _locale: unknown[]
          _parent_id: string
          id?: number
          label?: string | null
        }
        Update: {
          _locale?: unknown[]
          _parent_id?: string
          id?: number
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'forms_blocks_checkbox_locales_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'forms_blocks_checkbox'
            referencedColumns: ['id']
          },
        ]
      }
      forms_blocks_country: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          block_name: string | null
          id: string
          name: string
          required: boolean | null
          width: number | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          block_name?: string | null
          id: string
          name: string
          required?: boolean | null
          width?: number | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          block_name?: string | null
          id?: string
          name?: string
          required?: boolean | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'forms_blocks_country_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'forms'
            referencedColumns: ['id']
          },
        ]
      }
      forms_blocks_country_locales: {
        Row: {
          _locale: unknown[]
          _parent_id: string
          id: number
          label: string | null
        }
        Insert: {
          _locale: unknown[]
          _parent_id: string
          id?: number
          label?: string | null
        }
        Update: {
          _locale?: unknown[]
          _parent_id?: string
          id?: number
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'forms_blocks_country_locales_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'forms_blocks_country'
            referencedColumns: ['id']
          },
        ]
      }
      forms_blocks_email: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          block_name: string | null
          id: string
          name: string
          required: boolean | null
          width: number | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          block_name?: string | null
          id: string
          name: string
          required?: boolean | null
          width?: number | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          block_name?: string | null
          id?: string
          name?: string
          required?: boolean | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'forms_blocks_email_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'forms'
            referencedColumns: ['id']
          },
        ]
      }
      forms_blocks_email_locales: {
        Row: {
          _locale: unknown[]
          _parent_id: string
          id: number
          label: string | null
        }
        Insert: {
          _locale: unknown[]
          _parent_id: string
          id?: number
          label?: string | null
        }
        Update: {
          _locale?: unknown[]
          _parent_id?: string
          id?: number
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'forms_blocks_email_locales_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'forms_blocks_email'
            referencedColumns: ['id']
          },
        ]
      }
      forms_blocks_message: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          block_name: string | null
          id: string
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          block_name?: string | null
          id: string
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          block_name?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'forms_blocks_message_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'forms'
            referencedColumns: ['id']
          },
        ]
      }
      forms_blocks_message_locales: {
        Row: {
          _locale: unknown[]
          _parent_id: string
          id: number
          message: Json | null
        }
        Insert: {
          _locale: unknown[]
          _parent_id: string
          id?: number
          message?: Json | null
        }
        Update: {
          _locale?: unknown[]
          _parent_id?: string
          id?: number
          message?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'forms_blocks_message_locales_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'forms_blocks_message'
            referencedColumns: ['id']
          },
        ]
      }
      forms_blocks_number: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          block_name: string | null
          default_value: number | null
          id: string
          name: string
          required: boolean | null
          width: number | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          block_name?: string | null
          default_value?: number | null
          id: string
          name: string
          required?: boolean | null
          width?: number | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          block_name?: string | null
          default_value?: number | null
          id?: string
          name?: string
          required?: boolean | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'forms_blocks_number_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'forms'
            referencedColumns: ['id']
          },
        ]
      }
      forms_blocks_number_locales: {
        Row: {
          _locale: unknown[]
          _parent_id: string
          id: number
          label: string | null
        }
        Insert: {
          _locale: unknown[]
          _parent_id: string
          id?: number
          label?: string | null
        }
        Update: {
          _locale?: unknown[]
          _parent_id?: string
          id?: number
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'forms_blocks_number_locales_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'forms_blocks_number'
            referencedColumns: ['id']
          },
        ]
      }
      forms_blocks_select: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          block_name: string | null
          id: string
          name: string
          required: boolean | null
          width: number | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          block_name?: string | null
          id: string
          name: string
          required?: boolean | null
          width?: number | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          block_name?: string | null
          id?: string
          name?: string
          required?: boolean | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'forms_blocks_select_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'forms'
            referencedColumns: ['id']
          },
        ]
      }
      forms_blocks_select_locales: {
        Row: {
          _locale: unknown[]
          _parent_id: string
          default_value: string | null
          id: number
          label: string | null
        }
        Insert: {
          _locale: unknown[]
          _parent_id: string
          default_value?: string | null
          id?: number
          label?: string | null
        }
        Update: {
          _locale?: unknown[]
          _parent_id?: string
          default_value?: string | null
          id?: number
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'forms_blocks_select_locales_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'forms_blocks_select'
            referencedColumns: ['id']
          },
        ]
      }
      forms_blocks_select_options: {
        Row: {
          _order: number
          _parent_id: string
          id: string
          value: string
        }
        Insert: {
          _order: number
          _parent_id: string
          id: string
          value: string
        }
        Update: {
          _order?: number
          _parent_id?: string
          id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: 'forms_blocks_select_options_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'forms_blocks_select'
            referencedColumns: ['id']
          },
        ]
      }
      forms_blocks_select_options_locales: {
        Row: {
          _locale: unknown[]
          _parent_id: string
          id: number
          label: string
        }
        Insert: {
          _locale: unknown[]
          _parent_id: string
          id?: number
          label: string
        }
        Update: {
          _locale?: unknown[]
          _parent_id?: string
          id?: number
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: 'forms_blocks_select_options_locales_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'forms_blocks_select_options'
            referencedColumns: ['id']
          },
        ]
      }
      forms_blocks_state: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          block_name: string | null
          id: string
          name: string
          required: boolean | null
          width: number | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          block_name?: string | null
          id: string
          name: string
          required?: boolean | null
          width?: number | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          block_name?: string | null
          id?: string
          name?: string
          required?: boolean | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'forms_blocks_state_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'forms'
            referencedColumns: ['id']
          },
        ]
      }
      forms_blocks_state_locales: {
        Row: {
          _locale: unknown[]
          _parent_id: string
          id: number
          label: string | null
        }
        Insert: {
          _locale: unknown[]
          _parent_id: string
          id?: number
          label?: string | null
        }
        Update: {
          _locale?: unknown[]
          _parent_id?: string
          id?: number
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'forms_blocks_state_locales_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'forms_blocks_state'
            referencedColumns: ['id']
          },
        ]
      }
      forms_blocks_text: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          block_name: string | null
          id: string
          name: string
          required: boolean | null
          width: number | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          block_name?: string | null
          id: string
          name: string
          required?: boolean | null
          width?: number | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          block_name?: string | null
          id?: string
          name?: string
          required?: boolean | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'forms_blocks_text_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'forms'
            referencedColumns: ['id']
          },
        ]
      }
      forms_blocks_text_locales: {
        Row: {
          _locale: unknown[]
          _parent_id: string
          default_value: string | null
          id: number
          label: string | null
        }
        Insert: {
          _locale: unknown[]
          _parent_id: string
          default_value?: string | null
          id?: number
          label?: string | null
        }
        Update: {
          _locale?: unknown[]
          _parent_id?: string
          default_value?: string | null
          id?: number
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'forms_blocks_text_locales_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'forms_blocks_text'
            referencedColumns: ['id']
          },
        ]
      }
      forms_blocks_textarea: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          block_name: string | null
          id: string
          name: string
          required: boolean | null
          width: number | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          block_name?: string | null
          id: string
          name: string
          required?: boolean | null
          width?: number | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          block_name?: string | null
          id?: string
          name?: string
          required?: boolean | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'forms_blocks_textarea_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'forms'
            referencedColumns: ['id']
          },
        ]
      }
      forms_blocks_textarea_locales: {
        Row: {
          _locale: unknown[]
          _parent_id: string
          default_value: string | null
          id: number
          label: string | null
        }
        Insert: {
          _locale: unknown[]
          _parent_id: string
          default_value?: string | null
          id?: number
          label?: string | null
        }
        Update: {
          _locale?: unknown[]
          _parent_id?: string
          default_value?: string | null
          id?: number
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'forms_blocks_textarea_locales_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'forms_blocks_textarea'
            referencedColumns: ['id']
          },
        ]
      }
      forms_emails: {
        Row: {
          _order: number
          _parent_id: number
          bcc: string | null
          cc: string | null
          email_from: string | null
          email_to: string | null
          id: string
          reply_to: string | null
        }
        Insert: {
          _order: number
          _parent_id: number
          bcc?: string | null
          cc?: string | null
          email_from?: string | null
          email_to?: string | null
          id: string
          reply_to?: string | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          bcc?: string | null
          cc?: string | null
          email_from?: string | null
          email_to?: string | null
          id?: string
          reply_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'forms_emails_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'forms'
            referencedColumns: ['id']
          },
        ]
      }
      forms_emails_locales: {
        Row: {
          _locale: unknown[]
          _parent_id: string
          id: number
          message: Json | null
          subject: string
        }
        Insert: {
          _locale: unknown[]
          _parent_id: string
          id?: number
          message?: Json | null
          subject?: string
        }
        Update: {
          _locale?: unknown[]
          _parent_id?: string
          id?: number
          message?: Json | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: 'forms_emails_locales_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'forms_emails'
            referencedColumns: ['id']
          },
        ]
      }
      forms_locales: {
        Row: {
          _locale: unknown[]
          _parent_id: number
          confirmation_message: Json | null
          id: number
          submit_button_label: string | null
        }
        Insert: {
          _locale: unknown[]
          _parent_id: number
          confirmation_message?: Json | null
          id?: number
          submit_button_label?: string | null
        }
        Update: {
          _locale?: unknown[]
          _parent_id?: number
          confirmation_message?: Json | null
          id?: number
          submit_button_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'forms_locales_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'forms'
            referencedColumns: ['id']
          },
        ]
      }
      header: {
        Row: {
          created_at: string | null
          id: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      header_nav_items: {
        Row: {
          _order: number
          _parent_id: number
          id: string
          link_label: string
          link_new_tab: boolean | null
          link_type: Database['public']['Enums']['enum_header_nav_items_link_type'] | null
          link_url: string | null
        }
        Insert: {
          _order: number
          _parent_id: number
          id: string
          link_label: string
          link_new_tab?: boolean | null
          link_type?: Database['public']['Enums']['enum_header_nav_items_link_type'] | null
          link_url?: string | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          id?: string
          link_label?: string
          link_new_tab?: boolean | null
          link_type?: Database['public']['Enums']['enum_header_nav_items_link_type'] | null
          link_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'header_nav_items_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'header'
            referencedColumns: ['id']
          },
        ]
      }
      header_rels: {
        Row: {
          id: number
          order: number | null
          pages_id: number | null
          parent_id: number
          path: string
        }
        Insert: {
          id?: number
          order?: number | null
          pages_id?: number | null
          parent_id: number
          path: string
        }
        Update: {
          id?: number
          order?: number | null
          pages_id?: number | null
          parent_id?: number
          path?: string
        }
        Relationships: [
          {
            foreignKeyName: 'header_rels_pages_fk'
            columns: ['pages_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'header_rels_parent_fk'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'header'
            referencedColumns: ['id']
          },
        ]
      }
      heros: {
        Row: {
          alt_text: string | null
          created_at: string
          href: string | null
          id: number
          updated_at: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          href?: string | null
          id?: number
          updated_at?: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          href?: string | null
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      media: {
        Row: {
          alt: string
          caption: Json | null
          created_at: string
          filename: string | null
          filesize: number | null
          focal_x: number | null
          focal_y: number | null
          height: number | null
          id: number
          mime_type: string | null
          thumbnail_u_r_l: string | null
          updated_at: string
          url: string | null
          width: number | null
        }
        Insert: {
          alt: string
          caption?: Json | null
          created_at?: string
          filename?: string | null
          filesize?: number | null
          focal_x?: number | null
          focal_y?: number | null
          height?: number | null
          id?: number
          mime_type?: string | null
          thumbnail_u_r_l?: string | null
          updated_at?: string
          url?: string | null
          width?: number | null
        }
        Update: {
          alt?: string
          caption?: Json | null
          created_at?: string
          filename?: string | null
          filesize?: number | null
          focal_x?: number | null
          focal_y?: number | null
          height?: number | null
          id?: number
          mime_type?: string | null
          thumbnail_u_r_l?: string | null
          updated_at?: string
          url?: string | null
          width?: number | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          id: number
          ordered_by_id: number | null
          stripe_payment_intent_i_d: string | null
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          ordered_by_id?: number | null
          stripe_payment_intent_i_d?: string | null
          total: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          ordered_by_id?: number | null
          stripe_payment_intent_i_d?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'orders_ordered_by_id_users_id_fk'
            columns: ['ordered_by_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      orders_items: {
        Row: {
          _order: number
          _parent_id: number
          id: string
          price: number | null
          product_id: number
          quantity: number | null
        }
        Insert: {
          _order: number
          _parent_id: number
          id: string
          price?: number | null
          product_id: number
          quantity?: number | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          id?: string
          price?: number | null
          product_id?: number
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'orders_items_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'orders_items_product_id_products_id_fk'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      pages: {
        Row: {
          _status: Database['public']['Enums']['enum_pages_status'] | null
          created_at: string
          hero_media_id: number | null
          hero_rich_text: Json | null
          hero_type: Database['public']['Enums']['enum_pages_hero_type'] | null
          id: number
          meta_description: string | null
          meta_image_id: number | null
          meta_title: string | null
          published_at: string | null
          slug: string | null
          slug_lock: boolean | null
          title: string | null
          updated_at: string
        }
        Insert: {
          _status?: Database['public']['Enums']['enum_pages_status'] | null
          created_at?: string
          hero_media_id?: number | null
          hero_rich_text?: Json | null
          hero_type?: Database['public']['Enums']['enum_pages_hero_type'] | null
          id?: number
          meta_description?: string | null
          meta_image_id?: number | null
          meta_title?: string | null
          published_at?: string | null
          slug?: string | null
          slug_lock?: boolean | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          _status?: Database['public']['Enums']['enum_pages_status'] | null
          created_at?: string
          hero_media_id?: number | null
          hero_rich_text?: Json | null
          hero_type?: Database['public']['Enums']['enum_pages_hero_type'] | null
          id?: number
          meta_description?: string | null
          meta_image_id?: number | null
          meta_title?: string | null
          published_at?: string | null
          slug?: string | null
          slug_lock?: boolean | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'pages_hero_media_id_media_id_fk'
            columns: ['hero_media_id']
            isOneToOne: false
            referencedRelation: 'media'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pages_meta_image_id_media_id_fk'
            columns: ['meta_image_id']
            isOneToOne: false
            referencedRelation: 'media'
            referencedColumns: ['id']
          },
        ]
      }
      pages_blocks_archive: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          block_name: string | null
          id: string
          intro_content: Json | null
          limit: number | null
          populate_by: Database['public']['Enums']['enum_pages_blocks_archive_populate_by'] | null
          relation_to: Database['public']['Enums']['enum_pages_blocks_archive_relation_to'] | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          block_name?: string | null
          id: string
          intro_content?: Json | null
          limit?: number | null
          populate_by?: Database['public']['Enums']['enum_pages_blocks_archive_populate_by'] | null
          relation_to?: Database['public']['Enums']['enum_pages_blocks_archive_relation_to'] | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          block_name?: string | null
          id?: string
          intro_content?: Json | null
          limit?: number | null
          populate_by?: Database['public']['Enums']['enum_pages_blocks_archive_populate_by'] | null
          relation_to?: Database['public']['Enums']['enum_pages_blocks_archive_relation_to'] | null
        }
        Relationships: [
          {
            foreignKeyName: 'pages_blocks_archive_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
        ]
      }
      pages_blocks_banner: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          block_name: string | null
          content: Json | null
          id: string
          style: Database['public']['Enums']['enum_pages_blocks_banner_style'] | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          block_name?: string | null
          content?: Json | null
          id: string
          style?: Database['public']['Enums']['enum_pages_blocks_banner_style'] | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          block_name?: string | null
          content?: Json | null
          id?: string
          style?: Database['public']['Enums']['enum_pages_blocks_banner_style'] | null
        }
        Relationships: [
          {
            foreignKeyName: 'pages_blocks_banner_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
        ]
      }
      pages_blocks_code: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          block_name: string | null
          code: string | null
          id: string
          language: Database['public']['Enums']['enum_pages_blocks_code_language'] | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          block_name?: string | null
          code?: string | null
          id: string
          language?: Database['public']['Enums']['enum_pages_blocks_code_language'] | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          block_name?: string | null
          code?: string | null
          id?: string
          language?: Database['public']['Enums']['enum_pages_blocks_code_language'] | null
        }
        Relationships: [
          {
            foreignKeyName: 'pages_blocks_code_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
        ]
      }
      pages_blocks_content: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          block_name: string | null
          id: string
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          block_name?: string | null
          id: string
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          block_name?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'pages_blocks_content_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
        ]
      }
      pages_blocks_content_columns: {
        Row: {
          _order: number
          _parent_id: string
          enable_link: boolean | null
          id: string
          link_appearance:
            | Database['public']['Enums']['enum_pages_blocks_content_columns_link_appearance']
            | null
          link_label: string | null
          link_new_tab: boolean | null
          link_type:
            | Database['public']['Enums']['enum_pages_blocks_content_columns_link_type']
            | null
          link_url: string | null
          rich_text: Json | null
          size: Database['public']['Enums']['enum_pages_blocks_content_columns_size'] | null
        }
        Insert: {
          _order: number
          _parent_id: string
          enable_link?: boolean | null
          id: string
          link_appearance?:
            | Database['public']['Enums']['enum_pages_blocks_content_columns_link_appearance']
            | null
          link_label?: string | null
          link_new_tab?: boolean | null
          link_type?:
            | Database['public']['Enums']['enum_pages_blocks_content_columns_link_type']
            | null
          link_url?: string | null
          rich_text?: Json | null
          size?: Database['public']['Enums']['enum_pages_blocks_content_columns_size'] | null
        }
        Update: {
          _order?: number
          _parent_id?: string
          enable_link?: boolean | null
          id?: string
          link_appearance?:
            | Database['public']['Enums']['enum_pages_blocks_content_columns_link_appearance']
            | null
          link_label?: string | null
          link_new_tab?: boolean | null
          link_type?:
            | Database['public']['Enums']['enum_pages_blocks_content_columns_link_type']
            | null
          link_url?: string | null
          rich_text?: Json | null
          size?: Database['public']['Enums']['enum_pages_blocks_content_columns_size'] | null
        }
        Relationships: [
          {
            foreignKeyName: 'pages_blocks_content_columns_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'pages_blocks_content'
            referencedColumns: ['id']
          },
        ]
      }
      pages_blocks_cta: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          block_name: string | null
          id: string
          rich_text: Json | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          block_name?: string | null
          id: string
          rich_text?: Json | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          block_name?: string | null
          id?: string
          rich_text?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'pages_blocks_cta_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
        ]
      }
      pages_blocks_cta_links: {
        Row: {
          _order: number
          _parent_id: string
          id: string
          link_appearance:
            | Database['public']['Enums']['enum_pages_blocks_cta_links_link_appearance']
            | null
          link_label: string | null
          link_new_tab: boolean | null
          link_type: Database['public']['Enums']['enum_pages_blocks_cta_links_link_type'] | null
          link_url: string | null
        }
        Insert: {
          _order: number
          _parent_id: string
          id: string
          link_appearance?:
            | Database['public']['Enums']['enum_pages_blocks_cta_links_link_appearance']
            | null
          link_label?: string | null
          link_new_tab?: boolean | null
          link_type?: Database['public']['Enums']['enum_pages_blocks_cta_links_link_type'] | null
          link_url?: string | null
        }
        Update: {
          _order?: number
          _parent_id?: string
          id?: string
          link_appearance?:
            | Database['public']['Enums']['enum_pages_blocks_cta_links_link_appearance']
            | null
          link_label?: string | null
          link_new_tab?: boolean | null
          link_type?: Database['public']['Enums']['enum_pages_blocks_cta_links_link_type'] | null
          link_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'pages_blocks_cta_links_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'pages_blocks_cta'
            referencedColumns: ['id']
          },
        ]
      }
      pages_blocks_form_block: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          block_name: string | null
          enable_intro: boolean | null
          form_id: number | null
          id: string
          intro_content: Json | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          block_name?: string | null
          enable_intro?: boolean | null
          form_id?: number | null
          id: string
          intro_content?: Json | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          block_name?: string | null
          enable_intro?: boolean | null
          form_id?: number | null
          id?: string
          intro_content?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'pages_blocks_form_block_form_id_forms_id_fk'
            columns: ['form_id']
            isOneToOne: false
            referencedRelation: 'forms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pages_blocks_form_block_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
        ]
      }
      pages_blocks_media_block: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          block_name: string | null
          id: string
          media_id: number | null
          position: Database['public']['Enums']['enum_pages_blocks_media_block_position'] | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          block_name?: string | null
          id: string
          media_id?: number | null
          position?: Database['public']['Enums']['enum_pages_blocks_media_block_position'] | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          block_name?: string | null
          id?: string
          media_id?: number | null
          position?: Database['public']['Enums']['enum_pages_blocks_media_block_position'] | null
        }
        Relationships: [
          {
            foreignKeyName: 'pages_blocks_media_block_media_id_media_id_fk'
            columns: ['media_id']
            isOneToOne: false
            referencedRelation: 'media'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pages_blocks_media_block_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
        ]
      }
      pages_hero_links: {
        Row: {
          _order: number
          _parent_id: number
          id: string
          link_appearance:
            | Database['public']['Enums']['enum_pages_hero_links_link_appearance']
            | null
          link_label: string | null
          link_new_tab: boolean | null
          link_type: Database['public']['Enums']['enum_pages_hero_links_link_type'] | null
          link_url: string | null
        }
        Insert: {
          _order: number
          _parent_id: number
          id: string
          link_appearance?:
            | Database['public']['Enums']['enum_pages_hero_links_link_appearance']
            | null
          link_label?: string | null
          link_new_tab?: boolean | null
          link_type?: Database['public']['Enums']['enum_pages_hero_links_link_type'] | null
          link_url?: string | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          id?: string
          link_appearance?:
            | Database['public']['Enums']['enum_pages_hero_links_link_appearance']
            | null
          link_label?: string | null
          link_new_tab?: boolean | null
          link_type?: Database['public']['Enums']['enum_pages_hero_links_link_type'] | null
          link_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'pages_hero_links_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
        ]
      }
      pages_rels: {
        Row: {
          categories_id: number | null
          id: number
          order: number | null
          pages_id: number | null
          parent_id: number
          path: string
          posts_id: number | null
        }
        Insert: {
          categories_id?: number | null
          id?: number
          order?: number | null
          pages_id?: number | null
          parent_id: number
          path: string
          posts_id?: number | null
        }
        Update: {
          categories_id?: number | null
          id?: number
          order?: number | null
          pages_id?: number | null
          parent_id?: number
          path?: string
          posts_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'pages_rels_categories_fk'
            columns: ['categories_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pages_rels_pages_fk'
            columns: ['pages_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pages_rels_parent_fk'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pages_rels_posts_fk'
            columns: ['posts_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
        ]
      }
      payload_locked_documents: {
        Row: {
          created_at: string
          global_slug: string | null
          id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          global_slug?: string | null
          id?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          global_slug?: string | null
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      payload_locked_documents_rels: {
        Row: {
          banners_id: number | null
          cards_id: number | null
          categories_id: number | null
          contents_id: number | null
          events_id: number | null
          form_submissions_id: number | null
          forms_id: number | null
          heros_id: number | null
          id: number
          media_id: number | null
          order: number | null
          orders_id: number | null
          pages_id: number | null
          parent_id: number
          path: string
          posts_id: number | null
          prices_id: number | null
          products_id: number | null
          redirects_id: number | null
          slug_id: number | null
          subscriptions_id: string | null
          tags_id: number | null
          tenants_id: number | null
          users_id: number | null
        }
        Insert: {
          banners_id?: number | null
          cards_id?: number | null
          categories_id?: number | null
          contents_id?: number | null
          events_id?: number | null
          form_submissions_id?: number | null
          forms_id?: number | null
          heros_id?: number | null
          id?: number
          media_id?: number | null
          order?: number | null
          orders_id?: number | null
          pages_id?: number | null
          parent_id: number
          path: string
          posts_id?: number | null
          prices_id?: number | null
          products_id?: number | null
          redirects_id?: number | null
          slug_id?: number | null
          subscriptions_id?: string | null
          tags_id?: number | null
          tenants_id?: number | null
          users_id?: number | null
        }
        Update: {
          banners_id?: number | null
          cards_id?: number | null
          categories_id?: number | null
          contents_id?: number | null
          events_id?: number | null
          form_submissions_id?: number | null
          forms_id?: number | null
          heros_id?: number | null
          id?: number
          media_id?: number | null
          order?: number | null
          orders_id?: number | null
          pages_id?: number | null
          parent_id?: number
          path?: string
          posts_id?: number | null
          prices_id?: number | null
          products_id?: number | null
          redirects_id?: number | null
          slug_id?: number | null
          subscriptions_id?: string | null
          tags_id?: number | null
          tenants_id?: number | null
          users_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'payload_locked_documents_rels_banners_fk'
            columns: ['banners_id']
            isOneToOne: false
            referencedRelation: 'banners'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payload_locked_documents_rels_cards_fk'
            columns: ['cards_id']
            isOneToOne: false
            referencedRelation: 'cards'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payload_locked_documents_rels_categories_fk'
            columns: ['categories_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payload_locked_documents_rels_contents_fk'
            columns: ['contents_id']
            isOneToOne: false
            referencedRelation: 'contents'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payload_locked_documents_rels_events_fk'
            columns: ['events_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payload_locked_documents_rels_form_submissions_fk'
            columns: ['form_submissions_id']
            isOneToOne: false
            referencedRelation: 'form_submissions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payload_locked_documents_rels_forms_fk'
            columns: ['forms_id']
            isOneToOne: false
            referencedRelation: 'forms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payload_locked_documents_rels_heros_fk'
            columns: ['heros_id']
            isOneToOne: false
            referencedRelation: 'heros'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payload_locked_documents_rels_media_fk'
            columns: ['media_id']
            isOneToOne: false
            referencedRelation: 'media'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payload_locked_documents_rels_orders_fk'
            columns: ['orders_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payload_locked_documents_rels_pages_fk'
            columns: ['pages_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payload_locked_documents_rels_parent_fk'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'payload_locked_documents'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payload_locked_documents_rels_posts_fk'
            columns: ['posts_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payload_locked_documents_rels_prices_fk'
            columns: ['prices_id']
            isOneToOne: false
            referencedRelation: 'prices'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payload_locked_documents_rels_products_fk'
            columns: ['products_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payload_locked_documents_rels_redirects_fk'
            columns: ['redirects_id']
            isOneToOne: false
            referencedRelation: 'redirects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payload_locked_documents_rels_slug_fk'
            columns: ['slug_id']
            isOneToOne: false
            referencedRelation: 'slug'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payload_locked_documents_rels_subscriptions_fk'
            columns: ['subscriptions_id']
            isOneToOne: false
            referencedRelation: 'subscriptions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payload_locked_documents_rels_tags_fk'
            columns: ['tags_id']
            isOneToOne: false
            referencedRelation: 'tags'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payload_locked_documents_rels_tenants_fk'
            columns: ['tenants_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payload_locked_documents_rels_users_fk'
            columns: ['users_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      payload_migrations: {
        Row: {
          batch: number | null
          created_at: string
          id: number
          name: string | null
          updated_at: string
        }
        Insert: {
          batch?: number | null
          created_at?: string
          id?: number
          name?: string | null
          updated_at?: string
        }
        Update: {
          batch?: number | null
          created_at?: string
          id?: number
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payload_preferences: {
        Row: {
          created_at: string
          id: number
          key: string | null
          updated_at: string
          value: Json | null
        }
        Insert: {
          created_at?: string
          id?: number
          key?: string | null
          updated_at?: string
          value?: Json | null
        }
        Update: {
          created_at?: string
          id?: number
          key?: string | null
          updated_at?: string
          value?: Json | null
        }
        Relationships: []
      }
      payload_preferences_rels: {
        Row: {
          id: number
          order: number | null
          parent_id: number
          path: string
          users_id: number | null
        }
        Insert: {
          id?: number
          order?: number | null
          parent_id: number
          path: string
          users_id?: number | null
        }
        Update: {
          id?: number
          order?: number | null
          parent_id?: number
          path?: string
          users_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'payload_preferences_rels_parent_fk'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'payload_preferences'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payload_preferences_rels_users_fk'
            columns: ['users_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      posts: {
        Row: {
          _status: Database['public']['Enums']['enum_posts_status'] | null
          content: Json | null
          created_at: string
          id: number
          meta_description: string | null
          meta_image_id: number | null
          meta_title: string | null
          published_at: string | null
          slug: string | null
          slug_lock: boolean | null
          title: string | null
          updated_at: string
        }
        Insert: {
          _status?: Database['public']['Enums']['enum_posts_status'] | null
          content?: Json | null
          created_at?: string
          id?: number
          meta_description?: string | null
          meta_image_id?: number | null
          meta_title?: string | null
          published_at?: string | null
          slug?: string | null
          slug_lock?: boolean | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          _status?: Database['public']['Enums']['enum_posts_status'] | null
          content?: Json | null
          created_at?: string
          id?: number
          meta_description?: string | null
          meta_image_id?: number | null
          meta_title?: string | null
          published_at?: string | null
          slug?: string | null
          slug_lock?: boolean | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'posts_meta_image_id_media_id_fk'
            columns: ['meta_image_id']
            isOneToOne: false
            referencedRelation: 'media'
            referencedColumns: ['id']
          },
        ]
      }
      posts_populated_authors: {
        Row: {
          _order: number
          _parent_id: number
          id: string
          name: string | null
        }
        Insert: {
          _order: number
          _parent_id: number
          id: string
          name?: string | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          id?: string
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'posts_populated_authors_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
        ]
      }
      posts_rels: {
        Row: {
          categories_id: number | null
          id: number
          order: number | null
          parent_id: number
          path: string
          posts_id: number | null
          users_id: number | null
        }
        Insert: {
          categories_id?: number | null
          id?: number
          order?: number | null
          parent_id: number
          path: string
          posts_id?: number | null
          users_id?: number | null
        }
        Update: {
          categories_id?: number | null
          id?: number
          order?: number | null
          parent_id?: number
          path?: string
          posts_id?: number | null
          users_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'posts_rels_categories_fk'
            columns: ['categories_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'posts_rels_parent_fk'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'posts_rels_posts_fk'
            columns: ['posts_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'posts_rels_users_fk'
            columns: ['users_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      prices: {
        Row: {
          _status: Database['public']['Enums']['enum_prices_status'] | null
          created_at: string
          enable_paywall: boolean | null
          id: number
          price_j_s_o_n: string | null
          published_on: string | null
          skip_sync: boolean | null
          stripe_price_i_d: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          _status?: Database['public']['Enums']['enum_prices_status'] | null
          created_at?: string
          enable_paywall?: boolean | null
          id?: number
          price_j_s_o_n?: string | null
          published_on?: string | null
          skip_sync?: boolean | null
          stripe_price_i_d?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          _status?: Database['public']['Enums']['enum_prices_status'] | null
          created_at?: string
          enable_paywall?: boolean | null
          id?: number
          price_j_s_o_n?: string | null
          published_on?: string | null
          skip_sync?: boolean | null
          stripe_price_i_d?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      prices_blocks_archive: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          block_name: string | null
          id: string
          intro_content: Json | null
          limit: number | null
          populate_by: Database['public']['Enums']['enum_prices_blocks_archive_populate_by'] | null
          relation_to: Database['public']['Enums']['enum_prices_blocks_archive_relation_to'] | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          block_name?: string | null
          id: string
          intro_content?: Json | null
          limit?: number | null
          populate_by?: Database['public']['Enums']['enum_prices_blocks_archive_populate_by'] | null
          relation_to?: Database['public']['Enums']['enum_prices_blocks_archive_relation_to'] | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          block_name?: string | null
          id?: string
          intro_content?: Json | null
          limit?: number | null
          populate_by?: Database['public']['Enums']['enum_prices_blocks_archive_populate_by'] | null
          relation_to?: Database['public']['Enums']['enum_prices_blocks_archive_relation_to'] | null
        }
        Relationships: [
          {
            foreignKeyName: 'prices_blocks_archive_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'prices'
            referencedColumns: ['id']
          },
        ]
      }
      prices_blocks_cta: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          block_name: string | null
          id: string
          rich_text: Json | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          block_name?: string | null
          id: string
          rich_text?: Json | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          block_name?: string | null
          id?: string
          rich_text?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'prices_blocks_cta_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'prices'
            referencedColumns: ['id']
          },
        ]
      }
      prices_blocks_cta_links: {
        Row: {
          _order: number
          _parent_id: string
          id: string
          link_appearance:
            | Database['public']['Enums']['enum_prices_blocks_cta_links_link_appearance']
            | null
          link_label: string | null
          link_new_tab: boolean | null
          link_type: Database['public']['Enums']['enum_prices_blocks_cta_links_link_type'] | null
          link_url: string | null
        }
        Insert: {
          _order: number
          _parent_id: string
          id: string
          link_appearance?:
            | Database['public']['Enums']['enum_prices_blocks_cta_links_link_appearance']
            | null
          link_label?: string | null
          link_new_tab?: boolean | null
          link_type?: Database['public']['Enums']['enum_prices_blocks_cta_links_link_type'] | null
          link_url?: string | null
        }
        Update: {
          _order?: number
          _parent_id?: string
          id?: string
          link_appearance?:
            | Database['public']['Enums']['enum_prices_blocks_cta_links_link_appearance']
            | null
          link_label?: string | null
          link_new_tab?: boolean | null
          link_type?: Database['public']['Enums']['enum_prices_blocks_cta_links_link_type'] | null
          link_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'prices_blocks_cta_links_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'prices_blocks_cta'
            referencedColumns: ['id']
          },
        ]
      }
      prices_blocks_media_block: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          block_name: string | null
          id: string
          media_id: number | null
          position: Database['public']['Enums']['enum_prices_blocks_media_block_position'] | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          block_name?: string | null
          id: string
          media_id?: number | null
          position?: Database['public']['Enums']['enum_prices_blocks_media_block_position'] | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          block_name?: string | null
          id?: string
          media_id?: number | null
          position?: Database['public']['Enums']['enum_prices_blocks_media_block_position'] | null
        }
        Relationships: [
          {
            foreignKeyName: 'prices_blocks_media_block_media_id_media_id_fk'
            columns: ['media_id']
            isOneToOne: false
            referencedRelation: 'media'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'prices_blocks_media_block_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'prices'
            referencedColumns: ['id']
          },
        ]
      }
      prices_rels: {
        Row: {
          categories_id: number | null
          id: number
          order: number | null
          pages_id: number | null
          parent_id: number
          path: string
          posts_id: number | null
          prices_id: number | null
        }
        Insert: {
          categories_id?: number | null
          id?: number
          order?: number | null
          pages_id?: number | null
          parent_id: number
          path: string
          posts_id?: number | null
          prices_id?: number | null
        }
        Update: {
          categories_id?: number | null
          id?: number
          order?: number | null
          pages_id?: number | null
          parent_id?: number
          path?: string
          posts_id?: number | null
          prices_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'prices_rels_categories_fk'
            columns: ['categories_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'prices_rels_pages_fk'
            columns: ['pages_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'prices_rels_parent_fk'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'prices'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'prices_rels_posts_fk'
            columns: ['posts_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'prices_rels_prices_fk'
            columns: ['prices_id']
            isOneToOne: false
            referencedRelation: 'prices'
            referencedColumns: ['id']
          },
        ]
      }
      products: {
        Row: {
          _status: Database['public']['Enums']['enum_products_status'] | null
          created_at: string
          enable_paywall: boolean | null
          id: number
          price_j_s_o_n: string | null
          published_on: string | null
          skip_sync: boolean | null
          stripe_product_i_d: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          _status?: Database['public']['Enums']['enum_products_status'] | null
          created_at?: string
          enable_paywall?: boolean | null
          id?: number
          price_j_s_o_n?: string | null
          published_on?: string | null
          skip_sync?: boolean | null
          stripe_product_i_d?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          _status?: Database['public']['Enums']['enum_products_status'] | null
          created_at?: string
          enable_paywall?: boolean | null
          id?: number
          price_j_s_o_n?: string | null
          published_on?: string | null
          skip_sync?: boolean | null
          stripe_product_i_d?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      products_blocks_archive: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          block_name: string | null
          id: string
          intro_content: Json | null
          limit: number | null
          populate_by:
            | Database['public']['Enums']['enum_products_blocks_archive_populate_by']
            | null
          relation_to:
            | Database['public']['Enums']['enum_products_blocks_archive_relation_to']
            | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          block_name?: string | null
          id: string
          intro_content?: Json | null
          limit?: number | null
          populate_by?:
            | Database['public']['Enums']['enum_products_blocks_archive_populate_by']
            | null
          relation_to?:
            | Database['public']['Enums']['enum_products_blocks_archive_relation_to']
            | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          block_name?: string | null
          id?: string
          intro_content?: Json | null
          limit?: number | null
          populate_by?:
            | Database['public']['Enums']['enum_products_blocks_archive_populate_by']
            | null
          relation_to?:
            | Database['public']['Enums']['enum_products_blocks_archive_relation_to']
            | null
        }
        Relationships: [
          {
            foreignKeyName: 'products_blocks_archive_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      products_blocks_cta: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          block_name: string | null
          id: string
          rich_text: Json | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          block_name?: string | null
          id: string
          rich_text?: Json | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          block_name?: string | null
          id?: string
          rich_text?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'products_blocks_cta_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      products_blocks_cta_links: {
        Row: {
          _order: number
          _parent_id: string
          id: string
          link_appearance:
            | Database['public']['Enums']['enum_products_blocks_cta_links_link_appearance']
            | null
          link_label: string | null
          link_new_tab: boolean | null
          link_type: Database['public']['Enums']['enum_products_blocks_cta_links_link_type'] | null
          link_url: string | null
        }
        Insert: {
          _order: number
          _parent_id: string
          id: string
          link_appearance?:
            | Database['public']['Enums']['enum_products_blocks_cta_links_link_appearance']
            | null
          link_label?: string | null
          link_new_tab?: boolean | null
          link_type?: Database['public']['Enums']['enum_products_blocks_cta_links_link_type'] | null
          link_url?: string | null
        }
        Update: {
          _order?: number
          _parent_id?: string
          id?: string
          link_appearance?:
            | Database['public']['Enums']['enum_products_blocks_cta_links_link_appearance']
            | null
          link_label?: string | null
          link_new_tab?: boolean | null
          link_type?: Database['public']['Enums']['enum_products_blocks_cta_links_link_type'] | null
          link_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'products_blocks_cta_links_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'products_blocks_cta'
            referencedColumns: ['id']
          },
        ]
      }
      products_blocks_media_block: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          block_name: string | null
          id: string
          media_id: number | null
          position: Database['public']['Enums']['enum_products_blocks_media_block_position'] | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          block_name?: string | null
          id: string
          media_id?: number | null
          position?: Database['public']['Enums']['enum_products_blocks_media_block_position'] | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          block_name?: string | null
          id?: string
          media_id?: number | null
          position?: Database['public']['Enums']['enum_products_blocks_media_block_position'] | null
        }
        Relationships: [
          {
            foreignKeyName: 'products_blocks_media_block_media_id_media_id_fk'
            columns: ['media_id']
            isOneToOne: false
            referencedRelation: 'media'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_blocks_media_block_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      products_rels: {
        Row: {
          categories_id: number | null
          id: number
          order: number | null
          pages_id: number | null
          parent_id: number
          path: string
          posts_id: number | null
          products_id: number | null
        }
        Insert: {
          categories_id?: number | null
          id?: number
          order?: number | null
          pages_id?: number | null
          parent_id: number
          path: string
          posts_id?: number | null
          products_id?: number | null
        }
        Update: {
          categories_id?: number | null
          id?: number
          order?: number | null
          pages_id?: number | null
          parent_id?: number
          path?: string
          posts_id?: number | null
          products_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'products_rels_categories_fk'
            columns: ['categories_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_rels_pages_fk'
            columns: ['pages_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_rels_parent_fk'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_rels_posts_fk'
            columns: ['posts_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_rels_products_fk'
            columns: ['products_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      redirects: {
        Row: {
          created_at: string
          from: string
          id: number
          to_type: Database['public']['Enums']['enum_redirects_to_type'] | null
          to_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          from: string
          id?: number
          to_type?: Database['public']['Enums']['enum_redirects_to_type'] | null
          to_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          from?: string
          id?: number
          to_type?: Database['public']['Enums']['enum_redirects_to_type'] | null
          to_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      redirects_rels: {
        Row: {
          id: number
          order: number | null
          pages_id: number | null
          parent_id: number
          path: string
          posts_id: number | null
        }
        Insert: {
          id?: number
          order?: number | null
          pages_id?: number | null
          parent_id: number
          path: string
          posts_id?: number | null
        }
        Update: {
          id?: number
          order?: number | null
          pages_id?: number | null
          parent_id?: number
          path?: string
          posts_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'redirects_rels_pages_fk'
            columns: ['pages_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'redirects_rels_parent_fk'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'redirects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'redirects_rels_posts_fk'
            columns: ['posts_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
        ]
      }
      settings: {
        Row: {
          created_at: string | null
          id: number
          products_page_id: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          products_page_id?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          products_page_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'settings_products_page_id_pages_id_fk'
            columns: ['products_page_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
        ]
      }
      slug: {
        Row: {
          created_at: string
          description: string | null
          id: number
          name: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          name: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          name?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      slug_blocks_reusable_content: {
        Row: {
          _order: number
          _parent_id: number
          _path: string
          block_name: string | null
          id: string
          reference_id: number | null
        }
        Insert: {
          _order: number
          _parent_id: number
          _path: string
          block_name?: string | null
          id: string
          reference_id?: number | null
        }
        Update: {
          _order?: number
          _parent_id?: number
          _path?: string
          block_name?: string | null
          id?: string
          reference_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'slug_blocks_reusable_content_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'slug'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'slug_blocks_reusable_content_reference_id_contents_id_fk'
            columns: ['reference_id']
            isOneToOne: false
            referencedRelation: 'contents'
            referencedColumns: ['id']
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at: string | null
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          metadata: Json | null
          price_id: string
          quantity: number | null
          status: Database['public']['Enums']['enum_subscriptions_status']
          trial_end: string | null
          trial_start: string | null
          updated_at: string
          user_id_id: number
        }
        Insert: {
          cancel_at?: string | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id: string
          metadata?: Json | null
          price_id: string
          quantity?: number | null
          status: Database['public']['Enums']['enum_subscriptions_status']
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
          user_id_id: number
        }
        Update: {
          cancel_at?: string | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json | null
          price_id?: string
          quantity?: number | null
          status?: Database['public']['Enums']['enum_subscriptions_status']
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
          user_id_id?: number
        }
        Relationships: [
          {
            foreignKeyName: 'subscriptions_user_id_id_users_id_fk'
            columns: ['user_id_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      tags: {
        Row: {
          id: number
          name: string
          slug: string
        }
        Insert: {
          id?: number
          name: string
          slug: string
        }
        Update: {
          id?: number
          name?: string
          slug?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          created_at: string
          id: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenants_domains: {
        Row: {
          _order: number
          _parent_id: number
          domain: string
          id: string
        }
        Insert: {
          _order: number
          _parent_id: number
          domain: string
          id: string
        }
        Update: {
          _order?: number
          _parent_id?: number
          domain?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tenants_domains_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      tenants_roles: {
        Row: {
          id: number
          order: number
          parent_id: number
          value: Database['public']['Enums']['enum_tenants_roles'] | null
        }
        Insert: {
          id?: number
          order: number
          parent_id: number
          value?: Database['public']['Enums']['enum_tenants_roles'] | null
        }
        Update: {
          id?: number
          order?: number
          parent_id?: number
          value?: Database['public']['Enums']['enum_tenants_roles'] | null
        }
        Relationships: [
          {
            foreignKeyName: 'tenants_roles_parent_fk'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          hash: string | null
          id: number
          last_logged_in_tenant_id: number | null
          last_name: string | null
          lock_until: string | null
          login_attempts: number | null
          reset_password_expiration: string | null
          reset_password_token: string | null
          salt: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          hash?: string | null
          id?: number
          last_logged_in_tenant_id?: number | null
          last_name?: string | null
          lock_until?: string | null
          login_attempts?: number | null
          reset_password_expiration?: string | null
          reset_password_token?: string | null
          salt?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          hash?: string | null
          id?: number
          last_logged_in_tenant_id?: number | null
          last_name?: string | null
          lock_until?: string | null
          login_attempts?: number | null
          reset_password_expiration?: string | null
          reset_password_token?: string | null
          salt?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'users_last_logged_in_tenant_id_tenants_id_fk'
            columns: ['last_logged_in_tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      users_roles: {
        Row: {
          id: number
          order: number
          parent_id: number
          value: Database['public']['Enums']['enum_users_roles'] | null
        }
        Insert: {
          id?: number
          order: number
          parent_id: number
          value?: Database['public']['Enums']['enum_users_roles'] | null
        }
        Update: {
          id?: number
          order?: number
          parent_id?: number
          value?: Database['public']['Enums']['enum_users_roles'] | null
        }
        Relationships: [
          {
            foreignKeyName: 'users_roles_parent_fk'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      users_tenants: {
        Row: {
          _order: number
          _parent_id: number
          id: string
          tenant_id: number
        }
        Insert: {
          _order: number
          _parent_id: number
          id: string
          tenant_id: number
        }
        Update: {
          _order?: number
          _parent_id?: number
          id?: string
          tenant_id?: number
        }
        Relationships: [
          {
            foreignKeyName: 'users_tenants_parent_id_fk'
            columns: ['_parent_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'users_tenants_tenant_id_tenants_id_fk'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      users_tenants_roles: {
        Row: {
          id: number
          order: number
          parent_id: string
          value: Database['public']['Enums']['enum_users_tenants_roles'] | null
        }
        Insert: {
          id?: number
          order: number
          parent_id: string
          value?: Database['public']['Enums']['enum_users_tenants_roles'] | null
        }
        Update: {
          id?: number
          order?: number
          parent_id?: string
          value?: Database['public']['Enums']['enum_users_tenants_roles'] | null
        }
        Relationships: [
          {
            foreignKeyName: 'users_tenants_roles_parent_fk'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'users_tenants'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      _locales: 'en' | 'es' | 'de'
      enum__comments_v_published_locale: 'en' | 'es' | 'de'
      enum__comments_v_version_status: 'draft' | 'published'
      enum__pages_v_blocks_archive_populate_by: 'collection' | 'selection'
      enum__pages_v_blocks_archive_relation_to: 'products' | 'posts'
      enum__pages_v_blocks_banner_style: 'info' | 'warning' | 'error' | 'success'
      enum__pages_v_blocks_code_language: 'typescript' | 'javascript' | 'css'
      enum__pages_v_blocks_content_columns_link_appearance:
        | 'default'
        | 'primary'
        | 'secondary'
        | 'outline'
      enum__pages_v_blocks_content_columns_link_type: 'reference' | 'custom'
      enum__pages_v_blocks_content_columns_size: 'oneThird' | 'half' | 'twoThirds' | 'full'
      enum__pages_v_blocks_cta_links_link_appearance:
        | 'primary'
        | 'secondary'
        | 'default'
        | 'outline'
      enum__pages_v_blocks_cta_links_link_type: 'reference' | 'custom'
      enum__pages_v_blocks_media_block_position: 'default' | 'fullscreen'
      enum__pages_v_published_locale: 'en' | 'es' | 'de'
      enum__pages_v_version_hero_links_link_appearance:
        | 'default'
        | 'primary'
        | 'secondary'
        | 'outline'
      enum__pages_v_version_hero_links_link_type: 'reference' | 'custom'
      enum__pages_v_version_hero_type: 'none' | 'highImpact' | 'mediumImpact' | 'lowImpact'
      enum__pages_v_version_status: 'draft' | 'published'
      enum__posts_v_blocks_archive_populate_by: 'collection' | 'selection'
      enum__posts_v_blocks_archive_relation_to: 'products' | 'posts'
      enum__posts_v_blocks_content_columns_link_appearance:
        | 'default'
        | 'primary'
        | 'secondary'
        | 'outline'
      enum__posts_v_blocks_content_columns_link_type: 'reference' | 'custom'
      enum__posts_v_blocks_content_columns_size: 'oneThird' | 'half' | 'twoThirds' | 'full'
      enum__posts_v_blocks_cta_links_link_appearance:
        | 'primary'
        | 'secondary'
        | 'default'
        | 'outline'
      enum__posts_v_blocks_cta_links_link_type: 'reference' | 'custom'
      enum__posts_v_blocks_media_block_position: 'default' | 'fullscreen'
      enum__posts_v_published_locale: 'en' | 'es' | 'de'
      enum__posts_v_version_hero_links_link_appearance:
        | 'default'
        | 'primary'
        | 'secondary'
        | 'outline'
      enum__posts_v_version_hero_links_link_type: 'reference' | 'custom'
      enum__posts_v_version_hero_type:
        | 'none'
        | 'highImpact'
        | 'mediumImpact'
        | 'lowImpact'
        | 'customHero'
      enum__posts_v_version_status: 'draft' | 'published'
      enum__prices_v_blocks_archive_populate_by: 'collection' | 'selection'
      enum__prices_v_blocks_archive_relation_to: 'products' | 'posts'
      enum__prices_v_blocks_content_columns_link_appearance: 'default' | 'primary' | 'secondary'
      enum__prices_v_blocks_content_columns_link_type: 'reference' | 'custom'
      enum__prices_v_blocks_content_columns_size: 'oneThird' | 'half' | 'twoThirds' | 'full'
      enum__prices_v_blocks_cta_links_link_appearance:
        | 'primary'
        | 'secondary'
        | 'default'
        | 'outline'
      enum__prices_v_blocks_cta_links_link_type: 'reference' | 'custom'
      enum__prices_v_blocks_media_block_position: 'default' | 'fullscreen'
      enum__prices_v_published_locale: 'en' | 'es' | 'de'
      enum__prices_v_version_status: 'draft' | 'published'
      enum__products_v_blocks_archive_populate_by: 'collection' | 'selection'
      enum__products_v_blocks_archive_relation_to: 'products' | 'posts'
      enum__products_v_blocks_content_columns_link_appearance: 'default' | 'primary' | 'secondary'
      enum__products_v_blocks_content_columns_link_type: 'reference' | 'custom'
      enum__products_v_blocks_content_columns_size: 'oneThird' | 'half' | 'twoThirds' | 'full'
      enum__products_v_blocks_cta_links_link_appearance:
        | 'primary'
        | 'secondary'
        | 'default'
        | 'outline'
      enum__products_v_blocks_cta_links_link_type: 'reference' | 'custom'
      enum__products_v_blocks_media_block_position: 'default' | 'fullscreen'
      enum__products_v_published_locale: 'en' | 'es' | 'de'
      enum__products_v_version_status: 'draft' | 'published'
      enum_cards_loading: 'eager' | 'lazy'
      enum_comments_status: 'draft' | 'published'
      enum_contents_blocks_menu_menus_main_menu_sub_menu_link_type: 'reference' | 'custom'
      enum_contents_blocks_menu_menus_main_menu_type: 'reference' | 'custom' | 'none'
      enum_contents_blocks_menu_type: 'default'
      enum_contents_blocks_page_list_sort_by:
        | 'title'
        | 'createdAt'
        | 'updatedAt'
        | '-title'
        | '-createdAt'
        | '-updatedAt'
      enum_footer_nav_items_link_type: 'reference' | 'custom'
      enum_forms_confirmation_type: 'message' | 'redirect'
      enum_header_nav_items_link_type: 'reference' | 'custom'
      enum_layouts_blocks_menu_main_menu_sub_menu_link_appearance:
        | 'primary'
        | 'secondary'
        | 'default'
      enum_layouts_blocks_menu_menus_main_menu_sub_menu_link_type: 'reference' | 'custom'
      enum_layouts_blocks_menu_menus_main_menu_type: 'reference' | 'custom' | 'none'
      enum_layouts_blocks_menu_type: 'default'
      enum_layouts_blocks_page_list_sort_by:
        | 'title'
        | 'createdAt'
        | 'updatedAt'
        | '-title'
        | '-createdAt'
        | '-updatedAt'
      enum_pages_blocks_archive_populate_by: 'collection' | 'selection'
      enum_pages_blocks_archive_relation_to: 'products' | 'posts'
      enum_pages_blocks_banner_style: 'info' | 'warning' | 'error' | 'success'
      enum_pages_blocks_code_language: 'typescript' | 'javascript' | 'css'
      enum_pages_blocks_content_columns_link_appearance:
        | 'default'
        | 'primary'
        | 'secondary'
        | 'outline'
      enum_pages_blocks_content_columns_link_type: 'reference' | 'custom'
      enum_pages_blocks_content_columns_size: 'oneThird' | 'half' | 'twoThirds' | 'full'
      enum_pages_blocks_cta_links_link_appearance: 'primary' | 'secondary' | 'default' | 'outline'
      enum_pages_blocks_cta_links_link_type: 'reference' | 'custom'
      enum_pages_blocks_media_block_position: 'default' | 'fullscreen'
      enum_pages_hero_links_link_appearance: 'default' | 'primary' | 'secondary' | 'outline'
      enum_pages_hero_links_link_type: 'reference' | 'custom'
      enum_pages_hero_type: 'none' | 'highImpact' | 'mediumImpact' | 'lowImpact'
      enum_pages_status: 'draft' | 'published'
      enum_posts_blocks_archive_populate_by: 'collection' | 'selection'
      enum_posts_blocks_archive_relation_to: 'products' | 'posts'
      enum_posts_blocks_content_columns_link_appearance:
        | 'default'
        | 'primary'
        | 'secondary'
        | 'outline'
      enum_posts_blocks_content_columns_link_type: 'reference' | 'custom'
      enum_posts_blocks_content_columns_size: 'oneThird' | 'half' | 'twoThirds' | 'full'
      enum_posts_blocks_cta_links_link_appearance: 'primary' | 'secondary' | 'default' | 'outline'
      enum_posts_blocks_cta_links_link_type: 'reference' | 'custom'
      enum_posts_blocks_media_block_position: 'default' | 'fullscreen'
      enum_posts_hero_links_link_appearance: 'default' | 'primary' | 'secondary' | 'outline'
      enum_posts_hero_links_link_type: 'reference' | 'custom'
      enum_posts_hero_type: 'none' | 'highImpact' | 'mediumImpact' | 'lowImpact' | 'customHero'
      enum_posts_status: 'draft' | 'published'
      enum_prices_blocks_archive_populate_by: 'collection' | 'selection'
      enum_prices_blocks_archive_relation_to: 'products' | 'posts'
      enum_prices_blocks_content_columns_link_appearance: 'default' | 'primary' | 'secondary'
      enum_prices_blocks_content_columns_link_type: 'reference' | 'custom'
      enum_prices_blocks_content_columns_size: 'oneThird' | 'half' | 'twoThirds' | 'full'
      enum_prices_blocks_cta_links_link_appearance: 'primary' | 'secondary' | 'default' | 'outline'
      enum_prices_blocks_cta_links_link_type: 'reference' | 'custom'
      enum_prices_blocks_media_block_position: 'default' | 'fullscreen'
      enum_prices_status: 'draft' | 'published'
      enum_products_blocks_archive_populate_by: 'collection' | 'selection'
      enum_products_blocks_archive_relation_to: 'products' | 'posts'
      enum_products_blocks_content_columns_link_appearance: 'default' | 'primary' | 'secondary'
      enum_products_blocks_content_columns_link_type: 'reference' | 'custom'
      enum_products_blocks_content_columns_size: 'oneThird' | 'half' | 'twoThirds' | 'full'
      enum_products_blocks_cta_links_link_appearance:
        | 'primary'
        | 'secondary'
        | 'default'
        | 'outline'
      enum_products_blocks_cta_links_link_type: 'reference' | 'custom'
      enum_products_blocks_media_block_position: 'default' | 'fullscreen'
      enum_products_status: 'draft' | 'published'
      enum_redirects_to_type: 'reference' | 'custom'
      enum_slug_blocks_menu_main_menu_sub_menu_link_appearance: 'primary' | 'secondary' | 'default'
      enum_slug_blocks_page_list_sort_by:
        | 'title'
        | 'createdAt'
        | 'updatedAt'
        | '-title'
        | '-createdAt'
        | '-updatedAt'
      enum_subscriptions_status:
        | 'active'
        | 'canceled'
        | 'incomplete'
        | 'incomplete_expired'
        | 'trialing'
        | 'unpaid'
      enum_tenants_roles:
        | 'tenant-super-admin'
        | 'tenant-admin'
        | 'user-admin'
        | 'user-super-admin'
        | 'support-agent'
        | 'billing-manager'
        | 'compliance-officer'
        | 'content-manager'
        | 'project-manager'
        | 'viewer'
        | 'marketer'
        | 'api-consumer'
        | 'trainer'
        | 'moderator'
        | 'user'
        | 'customer'
      enum_users_roles:
        | 'super-admin'
        | 'user'
        | 'admin'
        | 'fighter'
        | 'customer'
        | 'tenants'
        | 'user-super-admin'
        | 'user-admin'
      enum_users_tenants_roles:
        | 'admin'
        | 'user'
        | 'super-admin'
        | 'tenant-super-admin'
        | 'tenant-admin'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, 'public'>]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    ? (PublicSchema['Tables'] & PublicSchema['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends keyof PublicSchema['Enums'] | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema['Enums']
    ? PublicSchema['Enums'][PublicEnumNameOrOptions]
    : never
