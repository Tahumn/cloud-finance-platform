FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt /app/requirements.txt

RUN pip install --upgrade pip \
    && pip install -r /app/requirements.txt

COPY app/__init__.py /app/app/__init__.py
COPY app/database.py /app/app/database.py
COPY app/core /app/app/core
COPY app/notifications /app/app/notifications
COPY app/workers/notifications_worker.py /app/app/workers/notifications_worker.py

COPY alembic.ini /app/alembic.ini
COPY alembic /app/alembic

CMD ["python", "-m", "app.workers.notifications_worker"]
