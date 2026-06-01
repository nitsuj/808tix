export type CheckInResult =
  | 'valid'
  | 'already_used'
  | 'invalid'
  | 'wrong_event'
  | 'voided';

export type PassStatus = 'active' | 'checked_in' | 'voided';

export type EventStatus = 'draft' | 'published' | 'completed' | 'cancelled';

export type ValidatePassResponse = {
  result: CheckInResult;
  pass_id?: string;
  guest_name?: string;
};

export type PublicPassView = {
  guest_name: string;
  pass_type: string;
  status: PassStatus;
  secure_token: string;
  event_name: string;
  event_slug: string;
  venue_name: string | null;
  event_date: string | null;
  start_time: string | null;
  description: string | null;
  image_url: string | null;
};

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
};

export type Event = {
  id: string;
  organizer_id: string;
  slug: string;
  name: string;
  venue_name: string | null;
  event_date: string | null;
  start_time: string | null;
  description: string | null;
  image_url: string | null;
  capacity: number;
  status: EventStatus;
  created_at: string;
  updated_at: string;
};

export type Pass = {
  id: string;
  event_id: string;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string | null;
  pass_type: string;
  secure_token: string;
  status: PassStatus;
  checked_in_at: string | null;
  checked_in_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CheckIn = {
  id: string;
  pass_id: string | null;
  event_id: string;
  scanned_by: string;
  result: CheckInResult;
  scanned_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & Pick<Profile, 'id'>;
        Update: Partial<Profile>;
        Relationships: [];
      };
      events: {
        Row: Event;
        Insert: Partial<Event> & Pick<Event, 'organizer_id' | 'slug' | 'name' | 'capacity'>;
        Update: Partial<Event>;
        Relationships: [];
      };
      passes: {
        Row: Pass;
        Insert: Partial<Pass> & Pick<Pass, 'event_id' | 'guest_name' | 'pass_type'>;
        Update: Partial<Pass>;
        Relationships: [];
      };
      checkins: {
        Row: CheckIn;
        Insert: Partial<CheckIn> & Pick<CheckIn, 'event_id' | 'scanned_by' | 'result'>;
        Update: Partial<CheckIn>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      validate_pass: {
        Args: {
          p_secure_token: string;
          p_event_id: string;
        };
        Returns: ValidatePassResponse;
      };
      get_pass_by_token: {
        Args: {
          p_secure_token: string;
        };
        Returns: PublicPassView | null;
      };
      get_event_stats: {
        Args: {
          p_event_id: string;
        };
        Returns: {
          issued_count: number;
          checked_in_count: number;
          capacity: number;
          remaining_count: number;
        };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
