export const ANILIST_API_URL = 'https://graphql.anilist.co';

export const GET_TRENDING_ANIMES = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, sort: TRENDING_DESC) {
      id
      title {
        romaji
        english
        native
      }
      coverImage {
        extraLarge
        large
        medium
        color
      }
      bannerImage
      description
      episodes
      status
      format
      seasonYear
      averageScore
      genres
    }
  }
}
`;

// Generic browse query: AniList ignores null variables, so every filter is optional.
export const BROWSE_ANIMES = `
query ($page: Int, $perPage: Int, $sort: [MediaSort], $season: MediaSeason, $seasonYear: Int, $genre: String, $search: String) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      hasNextPage
    }
    media(type: ANIME, isAdult: false, sort: $sort, season: $season, seasonYear: $seasonYear, genre: $genre, search: $search) {
      id
      title {
        romaji
        english
      }
      coverImage {
        extraLarge
        large
        color
      }
      bannerImage
      episodes
      status
      format
      seasonYear
      averageScore
      genres
    }
  }
}
`;

export const SEARCH_ANIMES = `
query ($search: String, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, search: $search, sort: POPULARITY_DESC) {
      id
      title {
        romaji
        english
      }
      coverImage {
        large
        color
      }
      episodes
      averageScore
      genres
    }
  }
}
`;

export const GET_ANIME_DETAILS = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    idMal
    nextAiringEpisode {
      episode
      airingAt
    }
    title {
      romaji
      english
      native
    }
    coverImage {
      extraLarge
      color
    }
    bannerImage
    description
    episodes
    duration
    status
    format
    seasonYear
    genres
    averageScore
    popularity
    trailer {
      id
      site
      thumbnail
    }
    relations {
      edges {
        relationType
        node {
          id
          title {
            romaji
            english
          }
          coverImage {
            large
            extraLarge
          }
          type
        }
      }
    }
    studios(isMain: true) {
      nodes {
        name
      }
    }
    streamingEpisodes {
      title
      thumbnail
      url
    }
  }
}
`;

export async function fetchAniList(query: string, variables: Record<string, unknown> = {}) {
  const response = await fetch(ANILIST_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch from AniList API');
  }

  const data = await response.json();
  return data.data;
}

export type MediaSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';

export function getCurrentSeason(date = new Date()): { season: MediaSeason; year: number } {
  const m = date.getMonth();
  const season: MediaSeason = m < 3 ? 'WINTER' : m < 6 ? 'SPRING' : m < 9 ? 'SUMMER' : 'FALL';
  return { season, year: date.getFullYear() };
}

export const AIRING_SCHEDULE = `
query ($page: Int, $from: Int, $to: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo {
      hasNextPage
    }
    airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
      id
      episode
      airingAt
      media {
        id
        isAdult
        countryOfOrigin
        popularity
        title {
          romaji
          english
        }
        coverImage {
          large
          color
        }
        format
      }
    }
  }
}
`;
