# docs/

Project knowledge base — tài liệu sản phẩm, kỹ thuật, nhật ký, nghiên cứu.

## Cấu trúc

```
docs/
├── product/                          # Cho users + sponsors
│   └── product-introduction.md       # Giới thiệu sản phẩm, vấn đề & giải pháp
│
├── technical/                        # Cho developers
│   ├── system-architecture.md        # Kiến trúc, luồng dữ liệu, diagrams
│   └── data-sources-catalog.md       # 10 data sources chi tiết
│
├── devlogs/                          # Nhật ký phát triển (theo ngày)
│   ├── devlog-260404-product-build.md        # Quá trình build MVP + P0
│   └── devlog-260404-agent-kit-best-practices.md  # MK patterns & lessons
│
├── research/                         # Nghiên cứu thị trường
│   └── research-260404-epidemic-products-and-needs.md
│
├── solutions/                        # Giải pháp đề xuất (từ external research)
│   ├── data-enrichment-pipeline.md
│   └── international-data-sources.md
│
├── pipelines-experiment/             # [NEW] Experimental ingestion pipelines
│   ├── README.md                     # Entry point: web+YT+FB keyword pipelines
│   ├── architecture-and-results.md   # Iterations v1→v3, 11 items tested
│   ├── tools-stack-reference.md      # Crawl4AI, M2.7, MLX Whisper, YouTube API
│   ├── integration-guide.md          # How to integrate into my-epidemic-monitor
│   ├── scripts/                      # Source code (4 pipelines + extractor)
│   └── sample-outputs/               # Real JSON outputs
│
└── development-roadmap.md            # Roadmap: completed + backlog
```

## Naming Convention
```
product/product-{topic}.md            # Tài liệu sản phẩm
technical/{topic}.md                  # Tài liệu kỹ thuật
devlogs/devlog-{YYMMDD}-{topic}.md   # Nhật ký theo ngày
research/research-{YYMMDD}-{topic}.md # Nghiên cứu
```

## Phân biệt docs/ vs plans/

| | docs/ | plans/ |
|---|---|---|
| **Audience** | Users, sponsors, devs | MK agents |
| **Timing** | Sau khi build | Trước/trong khi build |
| **Content** | Knowledge, architecture, research | Specs, phases, reports |
| **Maintain** | User yêu cầu cập nhật | Agents tự tạo |
