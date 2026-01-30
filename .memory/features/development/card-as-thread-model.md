# Memory: features/development/card-as-thread-model
Updated: 2026-01-30

Every development card initializes with an 'original thread' root activity (type 'card_created') using the card's title as the thread title. Quick actions in timeline banners (Add Comment, Ask Question, Upload) are routed directly to this original thread instead of spawning separate threads, ensuring the primary conversation remains centralized and accessible from the moment of creation.
