import { promises as fs } from "fs";
import path from "path";
import type { NextFunction, Request, Response } from "express";

interface HtmlIncludesOptions {
    publicDir: string;
    partialsDir: string;
}

const INCLUDE_RE = /^([ \t]*)<!--\s*include:([\w-]+)\s*-->/gm;

export function htmlIncludes({ publicDir, partialsDir }: HtmlIncludesOptions) {
    const cache = new Map<string, string>();

    async function readPartial(name: string): Promise<string | null> {
        if (cache.has(name)) return cache.get(name) as string;
        try {
            const content = await fs.readFile(path.join(partialsDir, `${name}.html`), "utf8");
            cache.set(name, content);
            return content;
        } catch {
            return null;
        }
    }

    function resolveHtmlFile(req: Request): string | null {
        if (req.method !== "GET" && req.method !== "HEAD") return null;
        if (req.path.startsWith("/api/")) return null;

        let filePath = req.path;
        if (filePath.endsWith("/")) filePath += "index.html";

        const ext = path.extname(filePath);
        if (ext === "") filePath += ".html";
        else if (ext !== ".html") return null;

        const absolute = path.join(publicDir, filePath);
        if (absolute !== publicDir && !absolute.startsWith(publicDir + path.sep)) return null;
        return absolute;
    }

    return async function htmlIncludesMiddleware(req: Request, res: Response, next: NextFunction) {
        const file = resolveHtmlFile(req);
        if (!file) return next();

        let source: string;
        try {
            const stat = await fs.stat(file);
            if (!stat.isFile()) return next();
            source = await fs.readFile(file, "utf8");
        } catch {
            return next();
        }

        if (!source.includes("<!-- include:")) return next();

        const names = new Set(Array.from(source.matchAll(INCLUDE_RE), (match) => match[2]));
        const partials = new Map<string, string | null>();
        for (const name of names) partials.set(name, await readPartial(name));

        const rendered = source.replace(INCLUDE_RE, (marker, indent: string, name: string) => {
            const content = partials.get(name);
            if (content == null) return marker;
            const lines = content.replace(/\n$/, "").split("\n");
            return lines.map((line, index) => (index === 0 || line ? indent + line : line)).join("\n");
        });

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.send(rendered);
    };
}
