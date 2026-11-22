-- Cover foreign keys used by joins, ownership policies, and cascading deletes.
create index conversation_turns_conversation_user_idx on public.conversation_turns (conversation_id, user_id);
create index conversation_turns_user_idx on public.conversation_turns (user_id);
create index peer_split_obligations_from_participant_idx on public.peer_split_obligations (from_participant_id);
create index peer_split_obligations_to_participant_idx on public.peer_split_obligations (to_participant_id);
create index peer_split_participants_linked_user_idx on public.peer_split_participants (linked_user_id) where linked_user_id is not null;
create index peer_splits_source_expense_idx on public.peer_splits (source_expense_id) where source_expense_id is not null;
