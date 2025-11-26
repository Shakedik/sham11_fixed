.PHONY: help up down logs build clean test kafka-monitor

help:
	@echo "📋 Commands:"
	@echo "  make up             - Start all services"
	@echo "  make down           - Stop all services"
	@echo "  make logs           - View all logs"
	@echo "  make build          - Rebuild all images"
	@echo "  make clean          - Clean everything"
	@echo "  make test           - Run health checks"
	@echo "  make kafka-monitor  - Monitor Kafka topics"

up:
	@echo "🚀 Starting distributed system..."
	docker-compose up -d
	@echo "✅ System started!"
	@echo "   Frontend: http://localhost:3000"
	@echo "   API Gateway (Unit 1): http://localhost:8001"
	@echo "   NER Service (Unit 2): http://localhost:8002"
	@echo "   Storage Service (Unit 3): http://localhost:8003"

down:
	@echo "🛑 Stopping all services..."
	docker-compose down

logs:
	docker-compose logs -f

logs-unit1:
	docker-compose logs -f unit1-api

logs-unit2:
	docker-compose logs -f unit2-ner

logs-unit3:
	docker-compose logs -f unit3-storage

logs-unit4:
	docker-compose logs -f unit4-frontend

logs-kafka:
	docker-compose logs -f kafka

build:
	@echo "🏗️  Building all images..."
	docker-compose build
	@echo "✅ Build complete!"

clean:
	@echo "🧹 Cleaning up..."
	docker-compose down -v --rmi all
	@echo "✅ Cleanup complete!"

test:
	@echo "🧪 Running health checks..."
	@echo "Kafka..."
	@docker-compose exec kafka kafka-topics --list --bootstrap-server localhost:9092 || echo "❌ Kafka not ready"
	@echo "Unit 1 (API)..."
	@curl -f http://localhost:8001/ || echo "❌ Unit 1 not ready"
	@echo "Unit 2 (NER)..."
	@curl -f http://localhost:8002/health || echo "❌ Unit 2 not ready"
	@echo "Unit 3 (Storage)..."
	@curl -f http://localhost:8003/health || echo "❌ Unit 3 not ready"
	@echo "✅ Health checks complete!"

kafka-topics:
	@echo "📊 Kafka Topics:"
	docker-compose exec kafka kafka-topics --list --bootstrap-server localhost:9092

kafka-consume-raw:
	@echo "👂 Monitoring 'raw-news' topic..."
	docker-compose exec kafka kafka-console-consumer \
		--bootstrap-server localhost:9092 \
		--topic raw-news \
		--from-beginning

kafka-consume-processed:
	@echo "👂 Monitoring 'processed-news' topic..."
	docker-compose exec kafka kafka-console-consumer \
		--bootstrap-server localhost:9092 \
		--topic processed-news \
		--from-beginning

restart:
	docker-compose restart

status:
	docker-compose ps
