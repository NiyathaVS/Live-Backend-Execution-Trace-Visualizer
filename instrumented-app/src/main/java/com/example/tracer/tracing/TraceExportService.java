package com.example.tracer.tracing;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class TraceExportService {

    public String toSvg(CallTreeNode root, String requestId) {
        if (root == null) {
            return "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"400\" height=\"60\">"
                    + "<text x=\"10\" y=\"30\">No trace</text></svg>";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"900\" height=\"")
                .append(Math.max(200, countNodes(root) * 28 + 40))
                .append("\" viewBox=\"0 0 900 ")
                .append(Math.max(200, countNodes(root) * 28 + 40))
                .append("\">\n");
        sb.append("<rect width=\"100%\" height=\"100%\" fill=\"#0f172a\"/>\n");
        sb.append("<text x=\"16\" y=\"24\" fill=\"#e5e7eb\" font-family=\"monospace\" font-size=\"14\">")
                .append("Trace ").append(escape(requestId))
                .append("</text>\n");
        renderNode(sb, root, 16, 40, 0);
        sb.append("</svg>");
        return sb.toString();
    }

    public byte[] toPdfBytes(CallTreeNode root, String requestId) {
        String text = flattenTreeText(root, requestId);
        return buildMinimalPdf(text);
    }

    private void renderNode(StringBuilder sb, CallTreeNode node, int x, int y, int depth) {
        String label = node.getMethodName() + " (" + node.getExecutionTime() + "ms)";
        String fill = node.hasError() ? "#7f1d1d" : (node.isSlowPath() ? "#9a3412" : "#1e293b");
        int barWidth = Math.min(700, (int) Math.max(80, node.getExecutionTime() * 2));

        sb.append("<rect x=\"").append(x + depth * 12).append("\" y=\"").append(y - 14)
                .append("\" width=\"").append(barWidth).append("\" height=\"20\" rx=\"4\" fill=\"")
                .append(fill).append("\"/>\n");
        sb.append("<text x=\"").append(x + depth * 12 + 6).append("\" y=\"").append(y)
                .append("\" fill=\"#e5e7eb\" font-family=\"monospace\" font-size=\"11\">")
                .append(escape(label))
                .append("</text>\n");

        int nextY = y + 26;
        for (CallTreeNode child : node.getChildren()) {
            renderNode(sb, child, x, nextY, depth + 1);
            nextY += 26;
        }
    }

    private int countNodes(CallTreeNode node) {
        int count = 1;
        for (CallTreeNode child : node.getChildren()) {
            count += countNodes(child);
        }
        return count;
    }

    private String flattenTreeText(CallTreeNode root, String requestId) {
        StringBuilder sb = new StringBuilder();
        sb.append("Execution Trace Report\n");
        sb.append("Request: ").append(requestId).append("\n\n");
        printTextTree(root, 0, sb);
        return sb.toString();
    }

    private void printTextTree(CallTreeNode node, int depth, StringBuilder sb) {
        sb.append("  ".repeat(depth))
                .append(node.getMethodName())
                .append(" (").append(node.getExecutionTime()).append("ms)\n");
        for (CallTreeNode child : node.getChildren()) {
            printTextTree(child, depth + 1, sb);
        }
    }

    /** Minimal single-page PDF (text lines) without external PDF libraries. */
    private byte[] buildMinimalPdf(String text) {
        String[] lines = text.split("\n");
        StringBuilder stream = new StringBuilder();
        stream.append("BT\n/F1 10 Tf\n");
        int y = 780;
        for (String line : lines) {
            if (y < 40) {
                break;
            }
            stream.append("50 ").append(y).append(" Td\n(")
                    .append(escapePdf(line))
                    .append(") Tj\n0 -14 Td\n");
            y -= 14;
        }
        stream.append("ET");

        String streamBody = stream.toString();
        List<String> objects = new ArrayList<>();
        objects.add("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj");
        objects.add("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj");
        objects.add("3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
                + "/Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj");
        objects.add("4 0 obj<< /Length " + streamBody.length() + " >>stream\n"
                + streamBody + "\nendstream endobj");
        objects.add("5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>endobj");

        StringBuilder pdf = new StringBuilder("%PDF-1.4\n");
        List<Integer> offsets = new ArrayList<>();
        for (String obj : objects) {
            offsets.add(pdf.length());
            pdf.append(obj).append("\n");
        }
        int xref = pdf.length();
        pdf.append("xref\n0 ").append(objects.size() + 1).append("\n");
        pdf.append("0000000000 65535 f \n");
        for (int offset : offsets) {
            pdf.append(String.format("%010d", offset)).append(" 00000 n \n");
        }
        pdf.append("trailer<< /Size ").append(objects.size() + 1)
                .append(" /Root 1 0 R >>\nstartxref\n").append(xref).append("\n%%EOF");
        return pdf.toString().getBytes();
    }

    private static String escape(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static String escapePdf(String s) {
        return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)");
    }
}
