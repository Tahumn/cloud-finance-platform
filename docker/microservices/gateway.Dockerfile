FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt /app/requirements.txt

RUN pip install --upgrade pip \
    && pip install -r /app/requirements.txt

COPY app/__init__.py /app/app/__init__.py
COPY app/core /app/app/core
COPY app/gateway_main.py /app/app/gateway_main.py

COPY alembic.ini /app/alembic.ini
COPY alembic /app/alembic

EXPOSE 8000

CMD ["uvicorn", "app.gateway_main:app", "--host", "0.0.0.0", "--port", "8000"]
