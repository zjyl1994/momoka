package utils

import "golang.org/x/sync/singleflight"

type SingleFlight[T any] struct {
	sf singleflight.Group
}

func (s *SingleFlight[T]) Do(key string, fn func() (T, error)) (T, error) {
	var zero T
	v, err, _ := s.sf.Do(key, func() (interface{}, error) {
		return fn()
	})
	if err != nil {
		return zero, err
	}
	return v.(T), nil
}
