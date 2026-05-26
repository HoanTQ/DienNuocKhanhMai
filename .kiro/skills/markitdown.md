---
inclusion: manual
---

# MarkItDown Skill

**Source**: [microsoft/markitdown](https://github.com/microsoft/markitdown) — Python tool for converting files and office documents to Markdown.

## Khi nào kích hoạt skill này

Kích hoạt khi user đề cập đến: "convert file", "chuyển đổi file", "markitdown", "file to markdown", "đọc PDF", "đọc Word", "đọc Excel", "đọc PowerPoint", "extract text", "trích xuất nội dung", hoặc bất kỳ yêu cầu nào liên quan đến việc chuyển đổi tài liệu sang Markdown.

## Tổng quan

MarkItDown là tiện ích Python nhẹ để chuyển đổi nhiều loại file sang Markdown, phục vụ cho LLM và các pipeline phân tích văn bản. Nó giữ lại cấu trúc tài liệu quan trọng (headings, lists, tables, links, v.v.).

### Định dạng được hỗ trợ

- PDF
- PowerPoint (.pptx)
- Word (.docx)
- Excel (.xlsx, .xls)
- Images (EXIF metadata và OCR)
- Audio (EXIF metadata và speech transcription)
- HTML
- Text-based formats (CSV, JSON, XML)
- ZIP files (duyệt qua nội dung bên trong)
- YouTube URLs
- EPubs
- Outlook messages (.msg)

## Cài đặt

### Yêu cầu
- Python 3.10 trở lên

### Cài đặt qua pip

```bash
# Cài tất cả optional dependencies
pip install 'markitdown[all]'

# Hoặc chỉ cài các format cần thiết
pip install 'markitdown[pdf, docx, pptx, xlsx]'
```

### Cài đặt từ source

```bash
git clone https://github.com/microsoft/markitdown.git
cd markitdown
pip install -e 'packages/markitdown[all]'
```

### Optional dependencies có sẵn

| Option                    | Mô tả                                        |
|---------------------------|-----------------------------------------------|
| `[all]`                   | Tất cả optional dependencies                  |
| `[pptx]`                  | PowerPoint files                              |
| `[docx]`                  | Word files                                    |
| `[xlsx]`                  | Excel files                                   |
| `[xls]`                   | Excel files cũ                                |
| `[pdf]`                   | PDF files                                     |
| `[outlook]`               | Outlook messages                              |
| `[az-doc-intel]`          | Azure Document Intelligence                   |
| `[audio-transcription]`   | Transcription wav/mp3                         |
| `[youtube-transcription]` | YouTube video transcription                   |

## Sử dụng

### Command-Line

```bash
# Convert file và xuất ra stdout
markitdown path-to-file.pdf

# Convert file và lưu ra file
markitdown path-to-file.pdf -o document.md

# Pipe content
cat path-to-file.pdf | markitdown

# Sử dụng Azure Document Intelligence
markitdown path-to-file.pdf -o document.md -d -e "<document_intelligence_endpoint>"
```

### Python API

```python
from markitdown import MarkItDown

# Basic usage
md = MarkItDown(enable_plugins=False)
result = md.convert("test.xlsx")
print(result.text_content)
```

```python
# Với LLM cho image descriptions
from markitdown import MarkItDown
from openai import OpenAI

client = OpenAI()
md = MarkItDown(llm_client=client, llm_model="gpt-4o")
result = md.convert("example.jpg")
print(result.text_content)
```

```python
# Với Azure Document Intelligence
from markitdown import MarkItDown

md = MarkItDown(docintel_endpoint="<document_intelligence_endpoint>")
result = md.convert("test.pdf")
print(result.text_content)
```

### Docker

```bash
docker build -t markitdown:latest .
docker run --rm -i markitdown:latest < ~/your-file.pdf > output.md
```

### Plugins

```bash
# Liệt kê plugins đã cài
markitdown --list-plugins

# Bật plugins khi convert
markitdown --use-plugins path-to-file.pdf
```

#### markitdown-ocr Plugin

Thêm OCR support cho PDF, DOCX, PPTX, XLSX — trích xuất text từ ảnh nhúng bằng LLM Vision.

```bash
pip install markitdown-ocr
pip install openai
```

```python
from markitdown import MarkItDown
from openai import OpenAI

md = MarkItDown(
    enable_plugins=True,
    llm_client=OpenAI(),
    llm_model="gpt-4o",
)
result = md.convert("document_with_images.pdf")
print(result.text_content)
```

## Hướng dẫn cho Agent

Khi user yêu cầu convert file trong workspace:

1. **Kiểm tra Python**: Chạy `python --version` để đảm bảo Python >= 3.10
2. **Kiểm tra markitdown**: Chạy `pip show markitdown` để xem đã cài chưa
3. **Cài đặt nếu cần**: `pip install 'markitdown[all]'`
4. **Convert file**: Sử dụng command-line `markitdown <file> -o <output.md>` hoặc Python API
5. **Đọc kết quả**: Đọc file markdown output và trình bày cho user

### Lưu ý bảo mật

- MarkItDown thực hiện I/O với quyền của process hiện tại
- Không truyền input không tin cậy trực tiếp vào MarkItDown
- Ưu tiên sử dụng API hẹp nhất phù hợp: `convert_local()` cho file local, `convert_stream()` cho stream
- Validate và restrict input trước khi gọi MarkItDown trong môi trường hosted/server-side

## Tham khảo

- Repository: https://github.com/microsoft/markitdown
- License: MIT
- Yêu cầu: Python 3.10+
