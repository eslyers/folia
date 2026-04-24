-- Migration: 015_add_vacation_balance_functions
-- Purpose: Add functions to return vacation balance when cancelling requests

CREATE OR REPLACE FUNCTION add_vacation_balance(
  p_user_id UUID,
  p_days INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET vacation_balance = vacation_balance + p_days
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION add_hours_balance(
  p_user_id UUID,
  p_minutes INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET hours_balance = hours_balance + p_minutes
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
