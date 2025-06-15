
-- Team table: Only the team owner or members can select; only the owner can update/delete

CREATE POLICY "Team owner or members can select their teams"
  ON public.teams FOR SELECT
  USING (created_by = auth.uid() OR id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));

CREATE POLICY "Team owner can update their teams"
  ON public.teams FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Team owner can delete their teams"
  ON public.teams FOR DELETE
  USING (created_by = auth.uid());

-- A user can manage their own team memberships
CREATE POLICY "Users can manage their own team membership"
  ON public.team_members FOR ALL
  USING (user_id = auth.uid());

-- A user can access FTP servers shared with them via shared_ftp_servers
CREATE POLICY "User can access shared ftp servers"
  ON public.shared_ftp_servers FOR ALL
  USING (user_id = auth.uid());
