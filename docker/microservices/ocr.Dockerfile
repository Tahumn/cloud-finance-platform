FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

WORKDIR /app

# CĂ i dependency há»‡ thá»‘ng trÆ°á»›c Ä‘á»ƒ táº­n dá»¥ng Docker cache
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        tesseract-ocr \
        tesseract-ocr-vie \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt

RUN pip install --upgrade pip \
    && pip install -r /app/requirements.txt

COPY app/__init__.py /app/app/__init__.py
COPY app/database.py /app/app/database.py
COPY app/core /app/app/core
COPY app/ocr /app/app/ocr
COPY app/services/ocr_main.py /app/app/services/ocr_main.py

COPY alembic.ini /app/alembic.ini
COPY alembic /app/alembic

EXPOSE 8000

CMD ["uvicorn", "app.services.ocr_main:app", "--host", "0.0.0.0", "--port", "8000"]
