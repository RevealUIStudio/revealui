import fs from "fs";
import path from "path";

const allowedFileExtensions = [".js", ".jsx", ".ts", ".tsx"];

const scanDirectory = (dirPath: fs.PathLike, depth = 0, maxDepth = 4) => {
  if (depth > maxDepth) return "";

  const items = fs.readdirSync(dirPath);
  let summary = "";

  items.forEach((item) => {
    const itemPath = path.join(dirPath as string, item);
    const stats = fs.statSync(itemPath);

    if (stats.isDirectory()) {
      summary += `Directory: ${item} (depth: ${depth})\n`;
      summary += scanDirectory(itemPath, depth + 1, maxDepth);
    } else {
      const ext = path.extname(item);
      summary += `File: ${item} (depth: ${depth})\n`;
      if (allowedFileExtensions.includes(ext)) {
        const fileContent = fs.readFileSync(itemPath, "utf-8");
        summary += `-- Content: \n${fileContent.substring(0, 300)}... (truncated)\n\n`;
      }
    }
  });

  return summary;
};

export async function POST(
  req: any,
  res: {
    status: (arg0: number) => {
      (): any;
      new (): any;
      json: { (arg0: { summary: string }): void; new (): any };
    };
  },
) {
  const directoriesToScan = [
    path.join(process.cwd(), "apps"),
    path.join(process.cwd(), "packages"),
  ];

  let codebaseSummary = "";

  directoriesToScan.forEach((dir) => {
    if (fs.existsSync(dir)) {
      codebaseSummary += `Scanning Directory: ${dir}\n`;
      codebaseSummary += scanDirectory(dir);
    }
  });

  res.status(200).json({ summary: codebaseSummary });
}
