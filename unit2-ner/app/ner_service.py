from transformers import pipeline

ner_model = pipeline("ner", grouped_entities=True)

def extract_entities(text):
    entities = ner_model(text)
    return [e["word"] for e in entities if e["score"] > 0.8]
