import spacy
nlp = spacy.load("en_core_web_sm")

# Exercise 1 — see how spaCy reads text
doc = nlp("Invoice from Amazon for ₹2500 on 12 Jan 2025")

print("print of speech")

for token in doc:
    print(token.text, token.pos_)  # pos = part of speech

print("=============================")
print("named entities")

# Exercise 2 — extract named entities
for ent in doc.ents:
    print(ent.text, ent.label_)  # labels like DATE, ORG, MONEY

print("--------------------------------")