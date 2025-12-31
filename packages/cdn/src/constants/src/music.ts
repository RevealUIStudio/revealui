interface MusicTrack {
  id: string;
  name: string;
  title: string;
  artist: string;
  cover: string;
  audio: string;
  captions: string;
  color: string[];
  active: boolean;
}

interface Genre {
  title: string;
  value: string;
}
export const music: MusicTrack[] = [
  {
    id: "1",
    title: "Street Beats",
    artist: "J Gottem",
    cover:
      "https://res.cloudinary.com/dpytkhyme/image/upload/v1693437335/scrap_records_logo_sdwhr8.png",
    audio:
      "https://isrnomxlkzfngwebohyx.supabase.co/storage/v1/object/public/songs/J%20Gottem%20-%20Street%20Beats.mp3",
    captions: "captions ",
    name: "Street Beats",
    color: ["blue"],
    active: true,
  },
  {
    id: "2",
    title: "Scrapyard Anthem",
    artist: "Ronin",
    cover:
      "https://res.cloudinary.com/dpytkhyme/image/upload/v1693437335/scrap_records_logo_sdwhr8.png",
    audio:
      "https://isrnomxlkzfngwebohyx.supabase.co/storage/v1/object/public/songs/Scrapyard%20anthem(LLJG).mp3",
    captions: "captions ",
    name: "Scrapyard Anthem",
    color: ["red"],
    active: false,
  },
  {
    id: "3",
    title: "STREETBEEFS SCRAPYARD",
    artist: "Chase Money feat. E.D.D.I.E. & Cadderson",
    cover:
      "https://res.cloudinary.com/dpytkhyme/image/upload/v1693437335/scrap_records_logo_sdwhr8.png",
    audio:
      "https://isrnomxlkzfngwebohyx.supabase.co/storage/v1/object/public/songs/STREETBEEFS%20SCRAPYARD.mp3",
    captions: "captions ",
    name: "STREETBEEFS SCRAPYARD",
    color: ["green"],
    active: true,
  },
];

export const genres: Genre[] = [
  { title: "Pop", value: "POP" },
  { title: "Hip-Hop", value: "HIP_HOP_RAP" },
  { title: "Dance", value: "DANCE" },
  { title: "Electronic", value: "ELECTRONIC" },
  { title: "Soul", value: "SOUL_RNB" },
  { title: "Alternative", value: "ALTERNATIVE" },
  { title: "Rock", value: "ROCK" },
  { title: "Latin", value: "LATIN" },
  { title: "Film", value: "FILM_TV" },
  { title: "Country", value: "COUNTRY" },
  { title: "Worldwide", value: "WORLDWIDE" },
  { title: "Reggae", value: "REGGAE_DANCE_HALL" },
  { title: "House", value: "HOUSE" },
  { title: "K-Pop", value: "K_POP" },
];

export const musicTracks = [
  {
    id: "1",
    title: "Fire Chicken",
    url: "https://www.youtube.com/watch?v=3-8wxIugeFg&t=18s",
    content: "Great Fight 1 ",
  },
  {
    id: "2",
    title: "Viking Warrior",
    url: "https://www.youtube.com/watch?v=aDHFVYthOM4",
    content: "Great Fight 2",
  },
  {
    id: "3",
    title: "The Beast",
    url: "https://www.youtube.com/watch?v=vxceVYeE0tk",
    content: "Great Fight 3",
  },
  {
    id: "4",
    title: "The Beast",
    url: "https://www.youtube.com/watch?v=pf6LNjTtEmQ&t=462s",
    content: "Great Fight 4",
  },
  {
    id: "5",
    title: "The Beast",
    url: "https://www.youtube.com/watch?v=itaQQoPXFRU&t=150s",
    content: "Great Fight 5",
  },
];

export const musicItems = [
  {
    id: "1",
    title: "Fire Chicken",
    url: "https://www.youtube.com/watch?v=3-8wxIugeFg&t=18s",
    content: "Great Fight 1 ",
  },
  {
    id: "2",
    title: "Viking Warrior",
    url: "https://www.youtube.com/watch?v=aDHFVYthOM4",
    content: "Great Fight 2",
  },
  {
    id: "3",
    title: "The Beast",
    url: "https://www.youtube.com/watch?v=vxceVYeE0tk",
    content: "Great Fight 3",
  },
  {
    id: "4",
    title: "The Beast",
    url: "https://www.youtube.com/watch?v=pf6LNjTtEmQ&t=462s",
    content: "Great Fight 4",
  },
  {
    id: "5",
    title: "The Beast",
    url: "https://www.youtube.com/watch?v=itaQQoPXFRU&t=150s",
    content: "Great Fight 5",
  },
];
