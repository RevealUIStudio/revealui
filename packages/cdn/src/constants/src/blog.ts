/* eslint-disable @typescript-eslint/no-explicit-any */
// import { cache } from "react";
interface PostDataParams {
  url: string;
  data: unknown;
}

export const blogPosts = [
  {
    id: 1,
    author: {
      name: "Steven Hagara",
      image:
        "https://res.cloudinary.com/dpytkhyme/image/upload/v1683938638/STREETBEEFS%20SCRAPYARD/295255880_10228797549547476_7761046072649495577_n_cb2cxt.jpg",
    },
    title: "Fighter Spotlight",
    href: "#",
    category: { name: "Fighter Spotlight", href: "#" },
    description:
      "Meet the fighters who are fighting for the community. Learn about their stories and what brought them to the Scrapyard.",
    date: "Aug 2021",
    datetime: "2021-08",
    image:
      "https://res.cloudinary.com/dpytkhyme/image/upload/v1683938638/STREETBEEFS%20SCRAPYARD/295255880_10228797549547476_7761046072649495577_n_cb2cxt.jpg",
    readingLength: "5 min",
  },
];

export const posts = [
  {
    id: "1",
    title: "Fight 1",
    url: "https://www.youtube.com/watch?v=3-8wxIugeFg&t=18s",
    content: "Great Fight 1 ",
  },
  {
    id: "2",
    title: "Fight 2",
    url: "https://www.youtube.com/watch?v=aDHFVYthOM4",
    content: "Great Fight 2",
  },
  {
    id: "3",
    title: "Fight 3",
    url: "https://www.youtube.com/watch?v=vxceVYeE0tk",
    content: "Great Fight 3",
  },
  {
    id: "4",
    title: "Fight 4",
    url: "https://www.youtube.com/watch?v=pf6LNjTtEmQ&t=462s",
    content: "Great Fight 4",
  },
  {
    id: "5",
    title: " Fight 5",
    url: "https://www.youtube.com/watch?v=itaQQoPXFRU&t=150s",
    content: "Great Fight 5",
  },
];
// const cachedPostData = cache(async ({ url, data }) => {
// const cachedPostData = async ({ url, data }: PostDataParams) => {
//   const key = `${url}-${JSON.stringify(data)}`;
//   const cachedValue = sessionStorage.getItem(key);

//   if (cachedValue) {
//     return JSON.parse(cachedValue);
//   } else {
//     const res = await fetch(url, {
//       method: "POST",
//       headers: new Headers({ "Content-Type": "application/json" }),
//       credentials: "same-origin",
//       body: JSON.stringify(data),
//     });

//     if (!res.ok) {
//       console.log("Error in postData", { url, data, res });
//       throw new Error("Failed to post data");
//     }

//     return res.json();
//   }
// };

// export const postData = async ({ url, data }: PostDataParams): Promise<any> => {
//   try {
//     return await cachedPostData({ url, data });
//   } catch (error) {
//     console.error("Error in postData", error);
//     throw error;
//   }
// };

// import { PostDataParams } from "reveal";

// export const postData = async ({
//   url,
//   data,
// }: PostDataParams): Promise<string> => {
//   try {
//     // console.log("posting,", url, data);

//     const res = await fetch(url, {
//       method: "POST",
//       headers: new Headers({ "Content-Type": "application/json" }),
//       credentials: "same-origin",
//       body: JSON.stringify(data),
//     });

//     if (!res.ok) {
//       console.log("Error in postData", { url, data, res });
//       throw new Error("Failed to post data");
//     }

//     return res.json();
//   } catch (error) {
//     console.error("Error in postData", error);
//     throw error;
//   }
// };
