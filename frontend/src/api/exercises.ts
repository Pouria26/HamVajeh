import { apiClient } from "./client";
import type {
  CheckAnswerResponse,
  CollocationExercisesResponse,
  RandomExerciseResponse,
} from "../types";

export function getRandomExercise() {
  return apiClient.get<RandomExerciseResponse>("/api/exercises/random");
}

export function getCollocationExercises(collocationId: number | string) {
  return apiClient.get<CollocationExercisesResponse>(
    `/api/exercises/collocation/${collocationId}`
  );
}

export function checkAnswer(exampleId: number, optionId: number) {
  return apiClient.post<CheckAnswerResponse>(`/api/exercises/${exampleId}/check`, { optionId });
}
