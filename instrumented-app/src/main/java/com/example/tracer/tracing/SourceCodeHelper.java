package com.example.tracer.tracing;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Helper to fetch source code snippets from Java files.
 * Searches in common source directories: src/main/java, src/test/java, etc.
 */
public class SourceCodeHelper {

    private static final String[] SOURCE_DIRS = {
        "src/main/java",
        "src/test/java",
        "src/java"
    };

    public static class SourceSnippet {
        public int startLine;
        public int endLine;
        public int highlightLine;
        public List<String> lines;
        public String fileName;

        public SourceSnippet(int startLine, int endLine, int highlightLine, List<String> lines, String fileName) {
            this.startLine = startLine;
            this.endLine = endLine;
            this.highlightLine = highlightLine;
            this.lines = lines;
            this.fileName = fileName;
        }

        public int getStartLine() { return startLine; }
        public int getEndLine() { return endLine; }
        public int getHighlightLine() { return highlightLine; }
        public List<String> getLines() { return lines; }
        public String getFileName() { return fileName; }
    }

    /**
     * Get source code snippet from a Java file.
     * Searches in standard Maven/Gradle directories.
     * 
     * @param className Full qualified class name (e.g., "com.example.tracer.UserService")
     * @param lineNumber Target line number (1-based)
     * @param contextLines Number of lines to show before and after
     * @return SourceSnippet with code lines, or null if not found
     */
    public static SourceSnippet getSourceSnippet(String className, int lineNumber, int contextLines) {
        try {
            // Try multiple source directory paths
            Optional<List<String>> sourceLines = findSourceFile(className);
            
            if (sourceLines.isEmpty() || lineNumber <= 0 || lineNumber > sourceLines.get().size()) {
                return null;
            }

            List<String> allLines = sourceLines.get();
            int startLine = Math.max(1, lineNumber - contextLines);
            int endLine = Math.min(allLines.size(), lineNumber + contextLines);
            List<String> snippet = new ArrayList<>();
            
            for (int i = startLine - 1; i < endLine; i++) {
                snippet.add(allLines.get(i));
            }

            String fileName = className.substring(className.lastIndexOf('.') + 1) + ".java";
            return new SourceSnippet(startLine, endLine, lineNumber, snippet, fileName);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Find the first source line of a method by scanning the .java file.
     */
    public static Optional<Integer> findMethodStartLine(String className, String methodName) {
        Optional<List<String>> sourceLines = findSourceFile(className);
        if (sourceLines.isEmpty()) {
            return Optional.empty();
        }

        Pattern methodPattern = Pattern.compile("\\b" + Pattern.quote(methodName) + "\\s*\\(");
        List<String> lines = sourceLines.get();
        for (int i = 0; i < lines.size(); i++) {
            String trimmed = lines.get(i).trim();
            if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
                continue;
            }
            if (methodPattern.matcher(lines.get(i)).find()) {
                return Optional.of(i + 1);
            }
        }
        return Optional.empty();
    }

    /**
     * Find and read a Java source file by class name.
     * Searches in src/main/java, src/test/java, etc.
     */
    private static Optional<List<String>> findSourceFile(String className) {
        // Convert class name to file path
        String filePath = className.replace(".", File.separator) + ".java";
        
        // Try from current working directory (and instrumented-app when run from repo root)
        String cwd = System.getProperty("user.dir");
        String[] baseDirs = { cwd, Paths.get(cwd, "instrumented-app").toString() };

        for (String baseDir : baseDirs) {
            for (String sourceDir : SOURCE_DIRS) {
                Path sourcePath = Paths.get(baseDir, sourceDir, filePath);
            
                if (Files.exists(sourcePath) && Files.isRegularFile(sourcePath)) {
                    try {
                        return Optional.of(readFileLines(sourcePath.toFile()));
                    } catch (Exception e) {
                        // Continue to next source dir
                    }
                }
            }
        }
        
        // Fallback: Try classpath (for compiled classes)
        try {
            String resourcePath = "/" + className.replace(".", "/") + ".java";
            InputStream is = SourceCodeHelper.class.getResourceAsStream(resourcePath);
            
            if (is == null) {
                is = ClassLoader.getSystemResourceAsStream(resourcePath);
            }
            
            if (is != null) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(is));
                List<String> lines = new ArrayList<>();
                String line;
                while ((line = reader.readLine()) != null) {
                    lines.add(line);
                }
                reader.close();
                return Optional.of(lines);
            }
        } catch (Exception e) {
            // Fall through to return empty
        }
        
        return Optional.empty();
    }

    /**
     * Read all lines from a file.
     */
    private static List<String> readFileLines(File file) throws Exception {
        List<String> lines = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
            String line;
            while ((line = reader.readLine()) != null) {
                lines.add(line);
            }
        }
        return lines;
    }
}
