-- Migration: 003_auto_profile_trigger.sql
-- Purpose: Automatically create user profile when new user signs up via Supabase Auth
-- This ensures public.users table stays synchronized with auth.users

-- Function to handle new user creation
-- Fires AFTER INSERT on auth.users to create corresponding public profile
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert new row into public.users table with data from auth.users
    INSERT INTO public.users (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute handle_new_user after new user registration
-- This automaticall syncs auth.users with public.users
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Note: This trigger requires that auth.users insert includes email
-- Supabase Auth automatically provides id and email on registration
