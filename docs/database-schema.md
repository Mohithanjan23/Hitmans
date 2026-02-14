Database Schema (PostgreSQL)
This document defines the PostgreSQL database schema for storing persistent game data like user accounts, match history, and leaderboards.

Schema Diagram (Conceptual)
+-------------+      +-----------------+      +-------------+
|    users    |      |  match_players  |      |   matches   |
+-------------+      +-----------------+      +-------------+
| id (PK)     |----->| user_id (FK)    |<-----| id (PK)     |
| username    |      | match_id (FK)   |      | map_id      |
| password_hash|     | kills           |      | started_at  |
| created_at  |      | deaths          |      | ended_at    |
| last_seen_at|      | score           |      | metadata    |
+-------------+      +-----------------+      +-------------+
       |
       |
       +------------->+---------------+
                      |  leaderboard  |
                      +---------------+
                      | user_id (FK)  |
                      | rating        |
                      | wins          |
                      | games_played  |
                      +---------------+

Table Definitions
1. users
Stores information about registered players.

Column

Type

Constraints

Description

id

UUID

PRIMARY KEY, DEFAULT gen_random_uuid()

Unique identifier for the user.

username

VARCHAR(32)

UNIQUE, NOT NULL

The player's display name. Indexed for lookups.

password_hash

TEXT

NULL

Hashed password for authentication. Null for guests.

created_at

TIMESTAMPTZ

NOT NULL, DEFAULT NOW()

Timestamp of account creation.

last_seen_at

TIMESTAMPTZ

NOT NULL, DEFAULT NOW()

Timestamp of the user's last activity.

Indexes:

A unique index on username for fast login checks.

2. matches
Stores metadata for each completed game match.

Column

Type

Constraints

Description

id

UUID

PRIMARY KEY, DEFAULT gen_random_uuid()

Unique identifier for the match.

map_id

VARCHAR(64)

NOT NULL

Identifier for the map the match was played on.

started_at

TIMESTAMPTZ

NOT NULL

Timestamp when the match began.

ended_at

TIMESTAMPTZ

NOT NULL

Timestamp when the match ended.

metadata

JSONB

NULL

Flexible field for game mode specific data (e.g., scores in TDM).

Note: Game servers should write to this table asynchronously after a match concludes to avoid blocking the main game loop.

3. match_players
A junction table that records the performance of each player in a specific match.

Column

Type

Constraints

Description

match_id

UUID

FK -> matches.id

Foreign key referencing the match.

user_id

UUID

FK -> users.id

Foreign key referencing the user. Nullable for guests.

kills

INT

NOT NULL, DEFAULT 0

Number of kills the player achieved.

deaths

INT

NOT NULL, DEFAULT 0

Number of times the player died.

score

INT

NOT NULL, DEFAULT 0

The player's final score in the match.

Composite Primary Key: (match_id, user_id)

Indexes:

An index on user_id to quickly query a player's match history.

4. leaderboard
Stores aggregated player statistics for ranking. This table is essentially a materialized view that can be updated by a trigger or a scheduled job.

Column

Type

Constraints

Description

user_id

UUID

PRIMARY KEY, FK -> users.id

Foreign key referencing the user.

rating

FLOAT

NOT NULL, DEFAULT 1000

The player's ELO or skill rating.

wins

INT

NOT NULL, DEFAULT 0

Total number of matches won.

games_played

INT

NOT NULL, DEFAULT 0

Total number of matches played.

Note: This table should be updated after each match concludes. For very high-traffic systems, these updates could be processed in a separate worker service to reduce load on the main database.