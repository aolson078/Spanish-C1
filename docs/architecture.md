# Architecture

```text
React renderer
  -> isolated Electron preload API
    -> Electron main-process use cases
      -> domain and persistence boundaries
      -> reference catalog
      -> AI provider interface
        -> Ollama adapter
```

The renderer has no Node integration and does not know the Ollama URL. The preload exposes two narrow operations. Ollama-specific request fields and untrusted-response validation stay inside `packages/ai-provider`.

The eventual host migration changes provider configuration rather than UI or learning-engine code. Phone networking remains deferred.
