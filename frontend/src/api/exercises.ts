import { apiClient } from "./client";
import type {
  CheckAnswerResponse,
  CollocationExercisesResponse,
  DailyChallengeResponse,
  RandomExerciseResponse,
} from "../types";

export function getRandomExercise() {
  return apiClient.get<RandomExerciseResponse>("/api/exercises/random");
}

export function getDailyChallenge() {
  return apiClient.get<DailyChallengeResponse>("/api/exercises/daily-challenge");
}

export function getCollocationExercises(collocationId: number | string) {
  return apiClient.get<CollocationExercisesResponse>(
    `/api/exercises/collocation/${collocationId}`
  );
}

export function checkAnswer(exampleId: number, optionId: number) {
  return apiClient.post<CheckAnswerResponse>(`/api/exercises/${exampleId}/check`, { optionId });
}
